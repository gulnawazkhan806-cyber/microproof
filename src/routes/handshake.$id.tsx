import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useRef } from "react";
import { QrBlock } from "@/components/microproof/qr-code";
import { Shell, buttonStyles, useMounted } from "@/components/microproof/ui";
import { offerText } from "@/lib/microproof/protocol";
import { discardDraft, useDb } from "@/lib/microproof/store";
import { agreementTitle } from "@/lib/microproof/templates";
import { readPayload } from "@/lib/microproof/protocol";

export const Route = createFileRoute("/handshake/$id")({ component: HandshakePage });

function HandshakePage() {
  const { id } = Route.useParams();
  const mounted = useMounted();
  const db = useDb();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agreement = db.agreements.find((item) => item.id === id);

  let title = "Agreement";
  if (agreement) {
    try {
      title = agreementTitle(readPayload(agreement.payload_json));
    } catch {
      title = "Agreement";
    }
  }

  return (
    <Shell>
      <div className="grid gap-5">
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
          <ArrowLeft className="size-4" aria-hidden />
          Ledger
        </Link>
        {!mounted ? <p className="text-sm text-muted">Opening the code…</p> : null}
        {mounted && !agreement ? (
          <div>
            <h1 className="font-serif text-3xl">Not on this device</h1>
            <p className="mt-2 text-sm text-muted">This agreement isn't in the local ledger.</p>
          </div>
        ) : null}
        {mounted && agreement && agreement.sig_party_b ? (
          <div className="grid gap-3">
            <h1 className="font-serif text-4xl leading-tight">Sealed</h1>
            <p className="text-muted">{title} has both signatures.</p>
            <Link to="/contract/$id" params={{ id }} className={buttonStyles({ size: "lg" })}>
              Open the certificate
            </Link>
          </div>
        ) : null}
        {mounted && agreement && !agreement.sig_party_b ? (
          <div className="grid gap-4">
            <div>
              <h1 className="font-serif text-4xl leading-tight">{title}</h1>
              <p className="mt-2 text-muted">
                You already signed. They scan this code, review the terms, and sign with their key. Then you scan their reply.
              </p>
            </div>
            <QrBlock
              ref={canvasRef}
              text={offerText(agreement)}
              label="Offer code for the other person"
              readback={`${agreement.sha256_hash.slice(0, 4)}…${agreement.sha256_hash.slice(-4)}`.toUpperCase()}
            />
            <Link to="/bench/$id" params={{ id }} className={buttonStyles({ size: "block" })}>
              Their phone is on this desk
            </Link>
            <Link to="/scan" className={buttonStyles({ variant: "line", size: "block" })}>
              Scan their reply
            </Link>
            <button
              type="button"
              className="text-sm font-semibold text-fault"
              onClick={() => {
                discardDraft(id);
                void navigate({ to: "/" });
              }}
            >
              Discard this draft
            </button>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
