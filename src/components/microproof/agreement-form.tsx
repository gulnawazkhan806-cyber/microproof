import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ImagePlus, MapPin, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, Field, fieldClass } from "@/components/microproof/ui";
import { compressPhoto, savePhoto } from "@/lib/microproof/photos";
import { createDraft } from "@/lib/microproof/store";
import { exampleFor, getTemplate } from "@/lib/microproof/templates";
import type { GpsFix, PhotoRef, TemplateType } from "@/lib/microproof/types";

type LocalPhoto = PhotoRef & { url: string };

function missing(template: TemplateType, fields: Record<string, string>, initiator: string, counterparty: string) {
  if (!initiator.trim() || !counterparty.trim()) return "Add your name and theirs.";
  for (const field of getTemplate(template).fields) {
    if (field.required && !(fields[field.key] ?? "").trim()) return `Add ${field.label.toLowerCase()}.`;
  }
  return null;
}

export function AgreementForm({ template, example }: { template: TemplateType; example: boolean }) {
  const navigate = useNavigate();
  const spec = getTemplate(template);
  const [initiator, setInitiator] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (example) {
      const sample = exampleFor(template);
      setInitiator(sample.initiator);
      setCounterparty(sample.counterparty);
      setFields(sample.fields);
    } else {
      const defaults: Record<string, string> = {};
      for (const field of spec.fields) {
        if (field.options?.[0]) defaults[field.key] = field.options[0];
      }
      setInitiator("");
      setCounterparty("");
      setFields(defaults);
    }
    setPhotos((current) => {
      for (const photo of current) URL.revokeObjectURL(photo.url);
      return [];
    });
    setGps(null);
    setError(null);
  }, [example, spec, template]);

  function setField(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function addPhotos(list: FileList | null) {
    if (!list) return;
    const room = 4 - photos.length;
    if (room <= 0) {
      setError("Four photos is the limit. Their fingerprints have to fit in the code.");
      return;
    }
    setError(null);
    const files = [...list].slice(0, room);
    for (const file of files) {
      try {
        const compressed = await compressPhoto(file);
        await savePhoto(compressed.hash, compressed.blob);
        const url = URL.createObjectURL(compressed.blob);
        setPhotos((current) =>
          current.some((photo) => photo.hash === compressed.hash)
            ? current
            : [...current, { hash: compressed.hash, label: file.name.replace(/\.[^.]+$/, "") || "Photo", url }],
        );
      } catch {
        setError("Couldn't read one of those images.");
      }
    }
  }

  function attachLocation() {
    if (!navigator.geolocation) {
      setError("Location isn't available in this browser.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocating(false);
      },
      () => {
        setError("Location was denied. You can still sign without it.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = missing(template, fields, initiator, counterparty);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const agreement = await createDraft({
        template,
        initiator,
        counterparty,
        fields,
        photos: photos.map(({ hash, label }) => ({ hash, label })),
        gps,
      });
      toast("Signed with your key");
      await navigate({ to: "/handshake/$id", params: { id: agreement.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign.");
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-brass uppercase">{spec.index}</p>
          <h1 className="font-serif text-3xl leading-tight">{spec.name}</h1>
        </div>
        <button
          type="button"
          className="mb-1 text-sm font-semibold text-seal"
          onClick={() => navigate({ to: "/new", search: { template, example: true } })}
        >
          Use an example
        </button>
      </div>
      <p className="text-sm text-muted">{spec.blurb} Default clauses are part of what you sign.</p>
      <Field label="Your name">
        <input className={fieldClass} value={initiator} maxLength={80} autoComplete="name" onChange={(event) => setInitiator(event.target.value)} />
      </Field>
      <Field label="Their name">
        <input className={fieldClass} value={counterparty} maxLength={80} onChange={(event) => setCounterparty(event.target.value)} />
      </Field>
      {spec.fields.map((field) => (
        <Field key={field.key} label={field.label}>
          {field.kind === "select" ? (
            <span className="relative block">
              <select
                className={`${fieldClass} appearance-none pr-10`}
                value={fields[field.key] ?? field.options?.[0] ?? ""}
                onChange={(event) => setField(field.key, event.target.value)}
              >
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            </span>
          ) : field.kind === "textarea" ? (
            <textarea
              className={`${fieldClass} min-h-28 py-2`}
              maxLength={field.maxLength}
              placeholder={field.placeholder}
              value={fields[field.key] ?? ""}
              onChange={(event) => setField(field.key, event.target.value)}
            />
          ) : (
            <input
              className={fieldClass}
              inputMode={field.kind === "money" ? "decimal" : undefined}
              type={field.kind === "date" ? "date" : "text"}
              maxLength={field.maxLength}
              placeholder={field.placeholder}
              value={fields[field.key] ?? ""}
              onChange={(event) => setField(field.key, event.target.value)}
            />
          )}
        </Field>
      ))}
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Photos</span>
          <span className="text-xs text-muted">{photos.length}/4</span>
        </div>
        <p className="text-sm text-muted">Only the SHA-256 of each image is signed. Show the pictures before they sign.</p>
        {photos.length > 0 ? (
          <ul className="grid grid-cols-2 gap-2">
            {photos.map((photo) => (
              <li key={photo.hash} className="relative">
                <img src={photo.url} alt={photo.label} className="h-28 w-full rounded-xl object-cover outline outline-1 -outline-offset-1 outline-ink/10" />
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-sheet text-ink shadow-border"
                  aria-label={`Remove ${photo.label}`}
                  onClick={() => {
                    URL.revokeObjectURL(photo.url);
                    setPhotos((current) => current.filter((item) => item.hash !== photo.hash));
                  }}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-sheet px-4 text-sm font-semibold text-ink shadow-border">
          <ImagePlus className="size-4" aria-hidden />
          Add a photo
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => {
              void addPhotos(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="line" onClick={attachLocation} disabled={locating}>
          <MapPin className="size-4" aria-hidden />
          {locating ? "Finding location…" : gps ? "Location attached" : "Attach location"}
        </Button>
        {gps ? (
          <button type="button" className="text-sm font-semibold text-muted" onClick={() => setGps(null)}>
            Remove
          </button>
        ) : null}
      </div>
      <section className="rounded-2xl bg-sheet px-4 py-3 shadow-border">
        <h2 className="font-serif text-lg">Included clauses</h2>
        <ol className="mt-2 grid list-decimal gap-2 pl-5 text-sm">
          {spec.clauses.map((clause) => (
            <li key={clause}>{clause}</li>
          ))}
        </ol>
      </section>
      {error ? (
        <p role="alert" className="text-sm text-fault">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="block" disabled={pending}>
        {pending ? "Signing…" : "Sign and show code"}
      </Button>
      <p className="text-center text-xs text-muted">This does not move money. Cash and bank apps stay outside the record.</p>
    </form>
  );
}
