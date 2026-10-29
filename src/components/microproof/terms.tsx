import { useEffect, useState } from "react";
import { loadPhoto } from "@/lib/microproof/photos";
import { agreementTitle, fieldRows, formatWhen, getTemplate, partyLines } from "@/lib/microproof/templates";
import type { Payload, PhotoRef } from "@/lib/microproof/types";

export function PhotoStrip({ photos }: { photos: PhotoRef[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  const photoKey = photos.map((photo) => `${photo.hash}:${photo.label}`).join("|");

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    const current = photos;
    void (async () => {
      const next: Record<string, string> = {};
      for (const photo of current) {
        try {
          const blob = await loadPhoto(photo.hash);
          if (!blob) continue;
          const url = URL.createObjectURL(blob);
          created.push(url);
          next[photo.hash] = url;
        } catch {
          // The hash still stands if the image isn't on this device.
        }
      }
      if (cancelled) {
        for (const url of created) URL.revokeObjectURL(url);
        return;
      }
      setUrls(next);
    })();
    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
    // photoKey is the stable identity of the hash list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey]);

  if (photos.length === 0) return null;

  return (
    <ul className="grid gap-3">
      {photos.map((photo) => (
        <li key={photo.hash} className="grid gap-2">
          {urls[photo.hash] ? (
            <img
              src={urls[photo.hash]}
              alt={photo.label}
              className="max-h-56 w-full rounded-xl object-cover outline outline-1 -outline-offset-1 outline-ink/10"
            />
          ) : (
            <p className="rounded-xl bg-paper px-3 py-2 text-sm text-muted">Image not on this device. The fingerprint is still part of the signed terms.</p>
          )}
          <p className="text-sm">
            <span className="font-semibold">{photo.label}</span>
            <span className="mt-1 block text-xs break-all text-muted tabular-nums">{photo.hash}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

export function Terms({ payload }: { payload: Payload }) {
  const spec = getTemplate(payload.template);
  const parties = partyLines(payload);
  const rows = fieldRows(payload);

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs font-semibold tracking-widest text-brass uppercase">{spec.name}</p>
        <h2 className="mt-1 font-serif text-3xl leading-tight">{agreementTitle(payload)}</h2>
        <p className="mt-1 text-sm text-muted">{formatWhen(payload.createdAt)}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {parties.map((party) => (
          <div key={party.side} className="rounded-xl bg-paper px-3 py-2">
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{party.role}</dt>
            <dd className="font-semibold">{party.name}</dd>
          </div>
        ))}
      </dl>
      <dl className="grid gap-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[7.5rem_1fr] gap-3 border-t border-line py-2">
            <dt className="text-sm text-muted">{row.label}</dt>
            <dd className="text-sm font-medium break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h3 className="font-serif text-lg">Clauses</h3>
        <ol className="mt-2 grid list-decimal gap-2 pl-5 text-sm">
          {payload.clauses.map((clause) => (
            <li key={clause}>{clause}</li>
          ))}
        </ol>
      </div>
      {payload.photos.length > 0 ? (
        <div>
          <h3 className="font-serif text-lg">Photo fingerprints</h3>
          <div className="mt-2">
            <PhotoStrip photos={payload.photos} />
          </div>
        </div>
      ) : null}
      {payload.gps ? (
        <p className="text-sm">
          <span className="text-muted">Location </span>
          <a
            className="font-semibold underline decoration-line underline-offset-2"
            href={`https://www.openstreetmap.org/?mlat=${payload.gps.lat}&mlon=${payload.gps.lng}#map=16/${payload.gps.lat}/${payload.gps.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            {payload.gps.lat.toFixed(5)}, {payload.gps.lng.toFixed(5)}
          </a>
          <span className="text-muted"> · ±{payload.gps.accuracy} m</span>
        </p>
      ) : null}
    </div>
  );
}
