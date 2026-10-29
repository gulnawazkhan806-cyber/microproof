import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { QrBlock, decodeCanvas } from "@/components/microproof/qr-code";
import { Terms } from "@/components/microproof/terms";
import { Button } from "@/components/microproof/ui";
import { fingerprint } from "@/lib/microproof/crypto";
import { acceptOffer, ensureBenchIdentity, useDb } from "@/lib/microproof/store";
import { authenticateOffer, offerText, parseMessage, type AuthenticatedOffer } from "@/lib/microproof/protocol";
import type { Agreement } from "@/lib/microproof/types";

function pause() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return new Promise((resolve) => setTimeout(resolve, reduce ? 0 : 650));
}

export function ProximityBench({ agreement }: { agreement: Agreement }) {
  const db = useDb();
  const offerRef = useRef<HTMLCanvasElement>(null);
  const replyRef = useRef<HTMLCanvasElement>(null);
  const [phone, setPhone] = useState<"a" | "b">("a");
  const [phase, setPhase] = useState<"idle" | "review" | "reply">("idle");
  const [offer, setOffer] = useState<AuthenticatedOffer | null>(null);
  const [offerRaw, setOfferRaw] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string | null>(null);
  const [acked, setAcked] = useState(agreement.sig_party_b !== null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const benchKey = db.benchIdentity ? fingerprint(db.benchIdentity.publicKey) : "created on first scan";

  async function scanOffer() {
    setError(null);
    setBusy(true);
    await pause();
    const text = offerRef.current ? decodeCanvas(offerRef.current) : null;
    if (!text) {
      setError("Couldn't read the code on your phone. Try the scan again.");
      setBusy(false);
      return;
    }
    try {
      const next = await authenticateOffer(text);
      if (next.id !== agreement.id) throw new Error("That code belongs to a different agreement.");
      setOffer(next);
      setOfferRaw(text);
      setPhase("review");
      setPhone("b");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not authenticate the code.");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!offerRaw) return;
    setError(null);
    setBusy(true);
    try {
      ensureBenchIdentity();
      const result = await acceptOffer(offerRaw, "bench");
      setResponseText(result.responseText);
      setPhase("reply");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function scanReply() {
    setError(null);
    setBusy(true);
    await pause();
    const text = replyRef.current ? decodeCanvas(replyRef.current) : null;
    if (!text) {
      setError("Couldn't read their reply. Make sure it's on screen and try again.");
      setBusy(false);
      return;
    }
    try {
      const message = parseMessage(text);
      if (message.kind !== "accept" || message.id !== agreement.id) {
        throw new Error("That code is not their reply to this agreement.");
      }
      if (message.sigB !== agreement.sig_party_b || message.pubB !== agreement.pub_party_b) {
        throw new Error("The picture doesn't match the signature that was just made.");
      }
      setAcked(true);
      setPhone("a");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the reply.");
    } finally {
      setBusy(false);
    }
  }

  const offerCode = offerText(agreement);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-serif text-3xl leading-tight">Two phones, one desk</h1>
        <p className="mt-1 text-sm text-muted">
          The other phone has its own key ({benchKey}), kept in this browser so you can rehearse a real dual signature.
          Each scan decodes the QR picture.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant={phone === "a" ? "ink" : "line"} onClick={() => setPhone("a")}>
          Your phone
        </Button>
        <Button variant={phone === "b" ? "ink" : "line"} onClick={() => setPhone("b")}>
          Their phone
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-fault">
          {error}
        </p>
      ) : null}
      <div className="relative grid gap-4">
        <section className={phone === "b" ? "hidden" : "min-w-0"}>
          <div className="grid gap-4 rounded-2xl bg-sheet p-4 shadow-border">
            <p className="text-xs font-semibold tracking-widest text-muted uppercase">Your phone</p>
            {acked ? (
              <div className="grid gap-3">
                <h2 className="font-serif text-2xl">Sealed on your phone</h2>
                <p className="text-sm text-muted">Their reply matched the code on their screen. Both signatures are stored here.</p>
                <Link to="/contract/$id" params={{ id: agreement.id }} className="text-sm font-semibold text-seal">
                  Open the certificate
                </Link>
              </div>
            ) : (
              <>
                <p className="text-sm">This is the offer, already signed with your key. Their phone reads this picture.</p>
                <QrBlock ref={offerRef} text={offerCode} label="Your offer code" readback={`${agreement.sha256_hash.slice(0, 4)}…${agreement.sha256_hash.slice(-4)}`.toUpperCase()} />
                {phase === "reply" && responseText ? (
                  <Button size="block" disabled={busy} onClick={() => void scanReply()}>
                    {busy ? "Reading their screen…" : "Scan their reply"}
                  </Button>
                ) : (
                  <p className="text-sm text-muted">Wait until they sign, then scan the reply code from their phone.</p>
                )}
              </>
            )}
          </div>
        </section>
        <section className={phone === "a" ? "hidden" : "min-w-0"}>
          <div className="grid gap-4 rounded-2xl bg-sheet p-4 shadow-border">
            <p className="text-xs font-semibold tracking-widest text-muted uppercase">Their phone</p>
            {phase === "idle" && !acked ? (
              <>
                <p className="text-sm">Point this phone at the code. Nothing about the terms is assumed until the picture decodes.</p>
                <Button size="block" disabled={busy} onClick={() => void scanOffer()}>
                  {busy ? "Reading their screen…" : "Scan their code"}
                </Button>
              </>
            ) : null}
            {phase === "review" && offer ? (
              <>
                <Terms payload={offer.payload} />
                <p className="text-sm text-muted">
                  You are named as {offer.payload.counterparty}. Signing confirms these terms with this phone's key.
                </p>
                <Button size="block" disabled={busy} onClick={() => void approve()}>
                  {busy ? "Signing…" : "Approve and sign"}
                </Button>
              </>
            ) : null}
            {phase === "reply" && responseText ? (
              acked ? (
                <>
                  <h2 className="font-serif text-2xl">Signature delivered</h2>
                  <p className="text-sm text-muted">Your phone read this reply. Both copies now carry the same two signatures.</p>
                </>
              ) : (
                <>
                  <h2 className="font-serif text-2xl">Signed. Show this reply.</h2>
                  <p className="text-sm text-muted">Your phone has to scan this second code before its copy is marked received.</p>
                  <QrBlock ref={replyRef} text={responseText} label="Signed reply code" />
                </>
              )
            ) : null}
            {acked && phase === "idle" ? (
              <p className="text-sm text-muted">This agreement was already sealed. Both signatures are on the certificate.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
