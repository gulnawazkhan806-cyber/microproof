import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { inspect, type Integrity } from "@/lib/microproof/protocol";
import type { Agreement } from "@/lib/microproof/types";

export function useIntegrity(agreement: Agreement | null): Integrity | null {
  const [result, setResult] = useState<Integrity | null>(null);
  const payload = agreement?.payload_json ?? "";
  const hash = agreement?.sha256_hash ?? "";
  const sigA = agreement?.sig_party_a ?? "";
  const sigB = agreement?.sig_party_b ?? "";
  const pubA = agreement?.pub_party_a ?? "";
  const pubB = agreement?.pub_party_b ?? "";

  useEffect(() => {
    if (!agreement) return;
    let live = true;
    void inspect(agreement).then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
    };
  }, [agreement, payload, hash, sigA, sigB, pubA, pubB]);

  return result;
}

function Row({ ok, label, detail }: { ok: boolean | null; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok === null ? (
        <span className="mt-0.5 size-4 shrink-0 rounded-full bg-line" aria-hidden />
      ) : ok ? (
        <Check className="mt-0.5 size-4 shrink-0 text-seal" aria-hidden />
      ) : (
        <X className="mt-0.5 size-4 shrink-0 text-fault" aria-hidden />
      )}
      <span>
        <span className="font-semibold">{label}</span>
        <span className="text-muted"> · {detail}</span>
      </span>
    </li>
  );
}

export function IntegrityPanel({ agreement }: { agreement: Agreement }) {
  const result = useIntegrity(agreement);
  const headline =
    result?.state === "sealed"
      ? "Both signatures check out."
      : result?.state === "waiting"
        ? "Your signature checks out. Theirs is still missing."
        : result
          ? "This record does not match its signatures."
          : "Checking the digest…";

  return (
    <section className="rounded-2xl bg-sheet px-4 py-3 shadow-border" aria-live="polite">
      <h2 className="font-serif text-lg">{headline}</h2>
      <ul className="mt-2 grid gap-1.5">
        <Row
          ok={result ? result.hashOk : null}
          label="Digest"
          detail={result?.hashOk ? "SHA-256 matches the stored terms" : result ? "Does not match the stored terms" : "Recomputing"}
        />
        <Row
          ok={result ? result.sigAOk : null}
          label="Initiator"
          detail={result?.sigAOk ? "Ed25519 signature verifies" : result ? "Signature failed" : "Checking"}
        />
        <Row
          ok={result ? (agreement.sig_party_b ? result.sigBOk : null) : null}
          label="Counterparty"
          detail={
            !agreement.sig_party_b
              ? "Not signed yet"
              : result?.sigBOk
                ? "Ed25519 signature verifies"
                : result
                  ? "Signature failed"
                  : "Checking"
          }
        />
      </ul>
    </section>
  );
}
