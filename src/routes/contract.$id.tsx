import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import { Certificate } from "@/components/microproof/certificate";
import { IntegrityPanel } from "@/components/microproof/integrity";
import { Button, Shell, StatusPill, useMounted } from "@/components/microproof/ui";
import { copyText } from "@/components/microproof/qr-code";
import { exportRecord } from "@/lib/microproof/protocol";
import { discardDraft, setStatus, useDb } from "@/lib/microproof/store";

export const Route = createFileRoute("/contract/$id")({ component: ContractPage });

function ContractPage() {
  const { id } = Route.useParams();
  const mounted = useMounted();
  const navigate = useNavigate();
  const agreement = useDb().agreements.find((item) => item.id === id);

  return (
    <Shell>
      <div className="grid gap-5">
        <div className="no-print grid gap-4">
          <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
            <ArrowLeft className="size-4" aria-hidden />
            Ledger
          </Link>
          {!mounted ? <p className="text-sm text-muted">Opening the record…</p> : null}
          {mounted && !agreement ? (
            <div>
              <h1 className="font-serif text-3xl">Not on this device</h1>
              <p className="mt-2 text-sm text-muted">The ledger only shows agreements signed or stored here.</p>
            </div>
          ) : null}
          {mounted && agreement ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <h1 className="font-serif text-4xl leading-tight">Record</h1>
                <StatusPill status={agreement.status} />
              </div>
              {agreement.status === "DISPUTED" ? (
                <p className="text-sm text-fault">Flagged disputed on this device. The signed terms were not rewritten.</p>
              ) : null}
              {agreement.status === "RESOLVED" ? (
                <p className="text-sm text-muted">Marked resolved on this device. The signed terms were not rewritten.</p>
              ) : null}
              <IntegrityPanel agreement={agreement} />
              <div className="grid gap-2">
                <Button variant="ink" size="block" onClick={() => window.print()}>
                  <Printer className="size-4" aria-hidden />
                  Print or save PDF
                </Button>
                {!agreement.sig_party_b ? (
                  <Link to="/handshake/$id" params={{ id }} className="inline-flex h-12 items-center justify-center rounded-full bg-seal px-5 text-base font-semibold text-seal-ink">
                    Continue the handshake
                  </Link>
                ) : null}
                <Button variant="line" size="block" onClick={() => void copyText(exportRecord(agreement), "Record copied")}>
                  Copy verification JSON
                </Button>
                {agreement.status === "SIGNED" || agreement.status === "RESOLVED" ? (
                  <Button variant="fault" onClick={() => { setStatus(id, "DISPUTED"); toast("Flagged disputed"); }}>
                    Flag as disputed
                  </Button>
                ) : null}
                {agreement.status === "DISPUTED" ? (
                  <Button variant="line" onClick={() => { setStatus(id, "RESOLVED"); toast("Marked resolved"); }}>
                    Mark resolved
                  </Button>
                ) : null}
                {agreement.status === "DRAFT" ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-fault"
                    onClick={() => {
                      discardDraft(id);
                      toast("Draft discarded");
                      void navigate({ to: "/" });
                    }}
                  >
                    Discard draft
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
        {mounted && agreement ? <Certificate agreement={agreement} /> : null}
      </div>
    </Shell>
  );
}
