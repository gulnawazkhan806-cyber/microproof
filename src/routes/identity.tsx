import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { copyText } from "@/components/microproof/qr-code";
import { Button, Shell, useMounted } from "@/components/microproof/ui";
import { fingerprint } from "@/lib/microproof/crypto";
import { resetIdentity, useDb } from "@/lib/microproof/store";

export const Route = createFileRoute("/identity")({ component: IdentityPage });

function IdentityPage() {
  const mounted = useMounted();
  const identity = useDb().identity;
  const [confirm, setConfirm] = useState(false);
  const fp = identity ? fingerprint(identity.publicKey) : "···· ····";

  return (
    <Shell>
      <div className="grid gap-6">
        <div>
          <h1 className="font-serif text-4xl leading-tight">Your key</h1>
          <p className="mt-2 text-muted">
            Every agreement you start or accept is signed with this Ed25519 key. Only the public half leaves the device, and only inside a code you choose to show.
          </p>
        </div>
        {!mounted || !identity ? (
          <p className="text-sm text-muted">Preparing the key…</p>
        ) : (
          <>
            <p className="font-serif text-4xl tabular-nums tracking-wide text-seal">{fp}</p>
            <dl className="grid gap-3 rounded-2xl bg-sheet px-4 py-4 shadow-border text-sm">
              <div>
                <dt className="text-muted">Created</dt>
                <dd className="font-semibold">{new Date(identity.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted">Public key</dt>
                <dd className="mt-1 break-all tabular-nums">{identity.publicKey}</dd>
              </div>
            </dl>
            <Button variant="line" onClick={() => void copyText(identity.publicKey, "Public key copied")}>
              Copy public key
            </Button>
            <section className="grid gap-2 text-sm text-muted">
              <p>
                On a phone, this key would sit in the hardware keystore. In this browser it stays in local storage on this device. It is never shown in full as a private key, and it is never uploaded.
              </p>
              <p>Rotating it does not erase old records. Those still verify against the public keys stored with them.</p>
            </section>
            {confirm ? (
              <div className="grid gap-2 rounded-2xl bg-fault/10 p-4">
                <p className="text-sm text-fault">The current private key will be replaced. You can't sign as this fingerprint again from this browser.</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ink"
                    onClick={() => {
                      const next = resetIdentity();
                      setConfirm(false);
                      toast(`New key ${fingerprint(next.publicKey)}`);
                    }}
                  >
                    Confirm rotation
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="fault" onClick={() => setConfirm(true)}>
                Rotate key
              </Button>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
