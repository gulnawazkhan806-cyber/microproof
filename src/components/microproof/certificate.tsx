import { fingerprint, groupHex } from "@/lib/microproof/crypto";
import { readPayload } from "@/lib/microproof/protocol";
import { formatWhen } from "@/lib/microproof/templates";
import type { Agreement } from "@/lib/microproof/types";
import { Terms } from "@/components/microproof/terms";
import { SealMark } from "@/components/microproof/ui";

export function Certificate({ agreement }: { agreement: Agreement }) {
  let payload: ReturnType<typeof readPayload> | null = null;
  try {
    payload = readPayload(agreement.payload_json);
  } catch {
    payload = null;
  }

  return (
    <article className="certificate relative overflow-hidden rounded-2xl bg-sheet shadow-border print:rounded-none">
      <div className="absolute inset-y-0 left-0 w-2 bg-seal" aria-hidden />
      <div className="grid gap-5 px-5 py-6 pl-7">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-seal">
              <SealMark className="size-6" />
              <span className="font-serif text-lg leading-none">MicroProof</span>
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-tight">Certificate of agreement</h2>
            <p className="mt-1 text-sm text-muted">Local proof record. Not a payment receipt.</p>
          </div>
          <p className="-rotate-6 rounded-full border-2 border-seal px-3 py-4 text-center text-xs font-semibold tracking-widest text-seal uppercase">
            {agreement.sig_party_b ? "Signed" : "Open"}
            <span className="mt-1 block tabular-nums tracking-normal">{agreement.sha256_hash.slice(0, 4)}</span>
          </p>
        </header>
        {payload ? <Terms payload={payload} /> : <p className="text-sm text-fault">The stored terms could not be read.</p>}
        <dl className="grid gap-3 border-t border-line pt-4 text-sm">
          <div>
            <dt className="text-muted">Record id</dt>
            <dd className="font-semibold break-all tabular-nums">{agreement.id}</dd>
          </div>
          <div>
            <dt className="text-muted">SHA-256 of canonical terms</dt>
            <dd className="font-semibold break-all tabular-nums">{groupHex(agreement.sha256_hash)}</dd>
          </div>
          <div>
            <dt className="text-muted">Initiator key {payload ? `· ${fingerprint(payload.initiatorPub)}` : ""}</dt>
            <dd className="break-all tabular-nums">{agreement.pub_party_a}</dd>
          </div>
          <div>
            <dt className="text-muted">Initiator signature</dt>
            <dd className="break-all tabular-nums">{agreement.sig_party_a}</dd>
          </div>
          <div>
            <dt className="text-muted">
              Counterparty key {agreement.pub_party_b ? `· ${fingerprint(agreement.pub_party_b)}` : ""}
            </dt>
            <dd className="break-all tabular-nums">{agreement.pub_party_b ?? "Not yet signed"}</dd>
          </div>
          <div>
            <dt className="text-muted">Counterparty signature</dt>
            <dd className="break-all tabular-nums">{agreement.sig_party_b ?? "Not yet signed"}</dd>
          </div>
          <div>
            <dt className="text-muted">Updated</dt>
            <dd>{formatWhen(agreement.updatedAt)}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted">
          Verify by recomputing SHA-256 over the canonical JSON (keys sorted, no extra whitespace) and checking both
          Ed25519 signatures against that raw 32-byte digest. The initiator public key is inside the signed terms. The
          counterparty key is authenticated by their signature. A local disputed or resolved flag is not part of the
          signed payload.
        </p>
      </div>
    </article>
  );
}
