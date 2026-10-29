import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell, StatusPill, buttonStyles, useMounted } from "@/components/microproof/ui";
import { useIntegrity } from "@/components/microproof/integrity";
import { readPayload } from "@/lib/microproof/protocol";
import { useDb } from "@/lib/microproof/store";
import { TEMPLATES, agreementTitle, getTemplate, partyLines } from "@/lib/microproof/templates";
import type { Agreement, AgreementStatus, TemplateType } from "@/lib/microproof/types";

export const Route = createFileRoute("/")({ component: Home });

type Filter = "ALL" | "DRAFT" | "SIGNED" | "DISPUTED";

function summary(agreement: Agreement) {
  try {
    const payload = readPayload(agreement.payload_json);
    const parties = partyLines(payload);
    return {
      title: agreementTitle(payload),
      kind: getTemplate(payload.template).name,
      parties: `${parties[0]?.name ?? ""} → ${parties[1]?.name ?? ""}`,
    };
  } catch {
    return { title: "Unreadable record", kind: agreement.template_type, parties: "Tamper check failed" };
  }
}

function RowMark({ agreement }: { agreement: Agreement }) {
  const result = useIntegrity(agreement);
  const label = result?.state === "sealed" ? "Intact" : result?.state === "waiting" ? "Hash intact" : result ? "Check failed" : "Checking";
  const tone = result?.state === "broken" ? "text-fault" : "text-muted";
  return <span className={tone}>{label}</span>;
}

function Home() {
  const mounted = useMounted();
  const db = useDb();
  const [filter, setFilter] = useState<Filter>("ALL");
  const agreements = useMemo(() => {
    return [...db.agreements].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [db.agreements]);
  const visible = agreements.filter((item) => (filter === "ALL" ? true : item.status === filter));
  const waiting = agreements.filter((item) => item.status === "DRAFT").length;

  return (
    <Shell>
      <div className="grid gap-6">
        <div>
          <h1 className="font-serif text-4xl leading-tight">Ledger</h1>
          <p className="mt-2 text-muted">
            Signed records stay on this device. Nothing is uploaded, and no payment moves through here.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link to="/new" className={buttonStyles({ size: "lg" })}>
            New agreement
          </Link>
          <Link to="/scan" className={buttonStyles({ variant: "line", size: "lg" })}>
            Scan a code
          </Link>
        </div>
        {!mounted ? <p className="text-sm text-muted">Reading this device…</p> : null}
        {mounted && agreements.length === 0 ? (
          <section>
            <h2 className="font-serif text-2xl">Nothing filed yet</h2>
            <p className="mt-1 text-sm text-muted">Write the terms, they sign your code, you scan their reply. Both of you keep the record.</p>
            <div className="mt-4 overflow-hidden rounded-2xl bg-sheet shadow-border">
              {(Object.keys(TEMPLATES) as TemplateType[]).map((id) => {
                const spec = TEMPLATES[id];
                return (
                  <Link
                    key={id}
                    to="/new"
                    search={{ template: id, example: true }}
                    className="grid grid-cols-[2.5rem_1fr] gap-2 border-t border-line px-4 py-3.5 first:border-t-0"
                  >
                    <span className="font-serif text-brass">{spec.index}</span>
                    <span>
                      <span className="block font-semibold">{spec.name}</span>
                      <span className="block text-sm text-muted">{spec.blurb}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}
        {mounted && agreements.length > 0 ? (
          <section className="grid gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-2xl">On this device</h2>
              <p className="text-sm text-muted">{waiting === 0 ? "None waiting" : `${waiting} waiting`}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["ALL", "All"],
                  ["DRAFT", "Waiting"],
                  ["SIGNED", "Sealed"],
                  ["DISPUTED", "Disputed"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  className={filter === id ? "h-9 rounded-full bg-ink px-3 text-sm font-semibold text-paper" : "h-9 rounded-full bg-sheet px-3 text-sm font-semibold text-ink shadow-border"}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {visible.length === 0 ? <p className="text-sm text-muted">Nothing in this filter.</p> : null}
            <div className="overflow-hidden rounded-2xl bg-sheet shadow-border">
              {visible.map((agreement) => {
                const item = summary(agreement);
                return (
                  <Link
                    key={agreement.id}
                    to="/contract/$id"
                    params={{ id: agreement.id }}
                    className="grid gap-1 border-t border-line px-4 py-3.5 first:border-t-0"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-semibold break-words">{item.title}</span>
                      <StatusPill status={agreement.status as AgreementStatus} />
                    </span>
                    <span className="text-sm text-muted">
                      {item.kind} · {item.parties}
                    </span>
                    <span className="text-xs">
                      <RowMark agreement={agreement} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </Shell>
  );
}
