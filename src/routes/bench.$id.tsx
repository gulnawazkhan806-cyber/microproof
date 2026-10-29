import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ProximityBench } from "@/components/microproof/bench";
import { Shell, useMounted } from "@/components/microproof/ui";
import { useDb } from "@/lib/microproof/store";

export const Route = createFileRoute("/bench/$id")({ component: BenchPage });

function BenchPage() {
  const { id } = Route.useParams();
  const mounted = useMounted();
  const agreement = useDb().agreements.find((item) => item.id === id);

  return (
    <Shell>
      <div className="mb-4">
        <Link to="/handshake/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
          <ArrowLeft className="size-4" aria-hidden />
          Offer code
        </Link>
      </div>
      {!mounted ? <p className="text-sm text-muted">Setting the second phone…</p> : null}
      {mounted && !agreement ? (
        <div>
          <h1 className="font-serif text-3xl">Not on this device</h1>
          <p className="mt-2 text-sm text-muted">Start the agreement on this phone before opening the bench.</p>
        </div>
      ) : null}
      {mounted && agreement ? <ProximityBench agreement={agreement} /> : null}
    </Shell>
  );
}
