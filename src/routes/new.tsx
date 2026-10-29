import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AgreementForm } from "@/components/microproof/agreement-form";
import { Shell } from "@/components/microproof/ui";
import { TEMPLATES } from "@/lib/microproof/templates";
import { isTemplate, type TemplateType } from "@/lib/microproof/types";

export const Route = createFileRoute("/new")({
  validateSearch: (search: Record<string, unknown>) => {
    const template = isTemplate(search.template) ? search.template : undefined;
    const example = search.example === true || search.example === "1" || search.example === "true";
    return {
      ...(template ? { template } : {}),
      ...(example ? { example: true as const } : {}),
    };
  },
  component: NewAgreement,
});

function NewAgreement() {
  const { template, example } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <Shell>
      {template ? (
        <div className="grid gap-4">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-semibold text-muted"
            onClick={() => navigate({ to: "/new", search: {} })}
          >
            <ArrowLeft className="size-4" aria-hidden />
            All types
          </button>
          <AgreementForm template={template} example={example === true} />
        </div>
      ) : (
        <div className="grid gap-4">
          <div>
            <h1 className="font-serif text-4xl leading-tight">New agreement</h1>
            <p className="mt-2 text-muted">Pick a form. Most of these take under a minute to sign.</p>
          </div>
          <div className="overflow-hidden rounded-2xl bg-sheet shadow-border">
            {(Object.keys(TEMPLATES) as TemplateType[]).map((id) => {
              const spec = TEMPLATES[id];
              return (
                <Link
                  key={id}
                  to="/new"
                  search={{ template: id }}
                  className="grid grid-cols-[2.5rem_1fr] gap-2 border-t border-line px-4 py-4 first:border-t-0"
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
        </div>
      )}
    </Shell>
  );
}
