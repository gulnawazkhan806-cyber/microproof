import jsQR from "jsqr";
import { Camera, ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, fieldClass } from "@/components/microproof/ui";

function decodeImageData(data: Uint8ClampedArray, width: number, height: number): string | null {
  return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

async function decodeFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not read that image."));
      element.src = url;
    });
    const sizes = [image.naturalWidth, 800].filter((size, index, all) => size > 0 && all.indexOf(size) === index);
    for (const width of sizes) {
      const scale = width / image.naturalWidth;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) continue;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const frame = context.getImageData(0, 0, canvas.width, canvas.height);
      const text = decodeImageData(frame.data, frame.width, frame.height);
      if (text) return text;
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function CodeCapture({ onText }: { onText: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState("");

  useEffect(() => {
    if (!cameraOn) return;
    const video = videoRef.current;
    if (!video) return;
    let cancel = false;
    let frame = 0;
    const streamHolder: { current: MediaStream | null } = { current: null };
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancel) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamHolder.current = stream;
        video.srcObject = stream;
        void video.play();
        const tick = () => {
          if (cancel || !context) return;
          if (video.readyState >= 2 && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);
            const shot = context.getImageData(0, 0, canvas.width, canvas.height);
            const text = decodeImageData(shot.data, shot.width, shot.height);
            if (text) {
              onTextRef.current(text);
              return;
            }
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!cancel) {
          setError("Camera isn't available here. Paste the code, or upload a picture of it.");
          setCameraOn(false);
        }
      });

    return () => {
      cancel = true;
      cancelAnimationFrame(frame);
      streamHolder.current?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraOn]);

  return (
    <div className="grid gap-4">
      {cameraOn ? (
        <video ref={videoRef} muted playsInline className="aspect-square w-full rounded-2xl bg-ink object-cover" />
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-fault">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant={cameraOn ? "ink" : "line"} onClick={() => setCameraOn((on) => !on)}>
          <Camera className="size-4" aria-hidden />
          {cameraOn ? "Stop camera" : "Use camera"}
        </Button>
        <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-sheet px-4 text-sm font-semibold text-ink shadow-border">
          <ImagePlus className="size-4" aria-hidden />
          Upload a picture
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void decodeFile(file).then((text) => {
                if (!text) setError("No QR code found in that picture.");
                else onText(text);
              });
            }}
          />
        </label>
      </div>
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = paste.trim();
          if (!text) {
            setError("Paste a code first.");
            return;
          }
          onText(text);
        }}
      >
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">Or paste the code</span>
          <textarea
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            className={`${fieldClass} min-h-28 py-2`}
            placeholder={'Starts with {"v":1'}
          />
        </label>
        <Button type="submit" size="block">
          Read pasted code
        </Button>
      </form>
    </div>
  );
}
