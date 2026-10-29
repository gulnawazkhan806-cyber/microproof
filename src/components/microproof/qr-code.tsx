import { create } from "qrcode";
import jsQR from "jsqr";
import { forwardRef, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/microproof/ui";

export async function copyText(value: string, message = "Copied") {
  try {
    await navigator.clipboard.writeText(value);
    toast(message);
  } catch {
    toast("Select the code text below and copy it");
  }
}

export function paintQr(canvas: HTMLCanvasElement, text: string) {
  let qr: ReturnType<typeof create>;
  try {
    qr = create(text, { errorCorrectionLevel: "M" });
  } catch {
    qr = create(text, { errorCorrectionLevel: "L" });
  }
  const size = qr.modules.size;
  const data = qr.modules.data;
  const quiet = 4;
  const scale = 8;
  const dimension = (size + quiet * 2) * scale;
  canvas.width = dimension;
  canvas.height = dimension;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not draw the code.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, dimension, dimension);
  context.fillStyle = "#1c1915";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y * size + x]) {
        context.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
      }
    }
  }
}

export function decodeCanvas(canvas: HTMLCanvasElement): string | null {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || canvas.width === 0) return null;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
  return code?.data ?? null;
}

export const QrBlock = forwardRef<HTMLCanvasElement, { text: string; label: string; readback?: string }>(
  function QrBlock({ text, label, readback }, ref) {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const canvas = typeof ref === "function" ? null : ref?.current;
      if (!canvas) return;
      try {
        paintQr(canvas, text);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not draw the code.");
      }
    }, [ref, text]);

    return (
      <figure className="grid gap-3">
        <div className="rounded-2xl bg-sheet p-3 shadow-border">
          <canvas ref={ref} className="h-auto w-full" role="img" aria-label={label} />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-fault">
            {error}
          </p>
        ) : null}
        {readback ? (
          <p className="text-center text-sm text-muted">
            Read-back <span className="font-semibold text-ink tabular-nums">{readback}</span>
          </p>
        ) : null}
        <div className="flex justify-center">
          <Button variant="line" onClick={() => void copyText(text, "Code copied")}>
            Copy code
          </Button>
        </div>
        <details>
          <summary className="text-sm text-muted">Code text, if a camera can't read it</summary>
          <textarea readOnly value={text} className="mt-2 h-28 w-full rounded-xl bg-paper p-3 font-sans text-xs break-all text-ink" />
        </details>
      </figure>
    );
  },
);
