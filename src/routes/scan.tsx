import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { QrBlock } from "@/components/microproof/qr-code";
import { CodeCapture } from "@/components/microproof/scanner";
import { Terms } from "@/components/microproof/terms";
import { Button, Shell } from "@/components/microproof/ui";
import { authenticateOffer, parseMessage, type AuthenticatedOffer } from "@/lib/microproof/protocol";
import { acceptOffer, applyAccept } from "@/lib/microproof/store";

export const Route = createFileRoute("/scan")({ component: ScanPage });

function ScanPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState<AuthenticatedOffer | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);

  async function onText(text: string) {
    setError(null);
    try {
      const message = parseMessage(text);
      if (message.kind === "accept") {
        const agreement = await applyAccept(text);
        toast("Reply sealed on this phone");
        await navigate({ to: "/contract/$id", params: { id: agreement.id } });
        return;
      }
      const authenticated = await authenticateOffer(text);
      setOffer(authenticated);
      setRaw(text);
      setResponse(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that code.");
    }
  }

  async function sign() {
    if (!raw) return;
    setBusy(true);
    setError(null);
    try {
      const result = await acceptOffer(raw, "primary");
      setResponse(result.responseText);
      toast("Signed with your key");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="grid gap-5">
        <div>
          <h1 className="font-serif text-4xl leading-tight">{response ? "Show your reply" : offer ? "Review the terms" : "Scan a code"}</h1>
          <p className="mt-2 text-muted">
            {response
              ? "They scan this reply to store your signature next to theirs."
              : offer
                ? "Check every line. Signing locks your key to this exact digest."
                : "Read an offer to sign it, or a reply that seals a draft you started."}
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-fault">
            {error}
          </p>
        ) : null}
        {!offer && !response ? <CodeCapture onText={(text) => void onText(text)} /> : null}
        {offer && !response ? (
          <div className="grid gap-4">
            <Terms payload={offer.payload} />
            <p className="text-sm text-muted">You are named as {offer.payload.counterparty}.</p>
            <Button size="block" disabled={busy} onClick={() => void sign()}>
              {busy ? "Signing…" : "Approve and sign"}
            </Button>
            <button
              type="button"
              className="text-sm font-semibold text-muted"
              onClick={() => {
                setOffer(null);
                setRaw(null);
              }}
            >
              Scan a different code
            </button>
          </div>
        ) : null}
        {response && offer ? (
          <div className="grid gap-4">
            <QrBlock text={response} label="Your signed reply" />
            <Link to="/contract/$id" params={{ id: offer.id }} className="text-center text-sm font-semibold text-seal">
              Open your copy of the record
            </Link>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
