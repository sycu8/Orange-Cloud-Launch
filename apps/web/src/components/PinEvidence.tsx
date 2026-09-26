import { useRef, useState } from "react";
import { getCsrfToken } from "../lib/api";
import { Button, Input, Label, Notice } from "./ui";

export type ReviewPin = {
  artifactId: string;
  xNorm: number;
  yNorm: number;
  note: string;
  viewportWidth: number;
  viewportHeight: number;
};

type Props = {
  uploadUrl: string;
  pins: ReviewPin[];
  onChange: (pins: ReviewPin[]) => void;
};

export function PinEvidence({ uploadUrl, pins, onChange }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeArtifact, setActiveArtifact] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const headers: HeadersInit = {};
      const csrf = getCsrfToken();
      if (csrf) headers["X-CSRF-Token"] = csrf;
      const res = await fetch(uploadUrl, {
        method: "POST",
        body,
        credentials: "include",
        headers,
      });
      const data = (await res.json()) as { id?: string; message?: string };
      if (!res.ok || !data.id) throw new Error(data.message || "Upload failed");
      setActiveArtifact(data.id);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function placePin(e: React.MouseEvent<HTMLButtonElement>) {
    if (!activeArtifact || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const xNorm = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const yNorm = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    onChange([
      ...pins,
      {
        artifactId: activeArtifact,
        xNorm,
        yNorm,
        note: note.trim(),
        viewportWidth: Math.round(rect.width),
        viewportHeight: Math.round(rect.height),
      },
    ]);
    setNote("");
  }

  return (
    <div className="space-y-3 rounded-[16px] border border-border bg-surface p-4">
      <div>
        <Label>Screenshot pin (optional)</Label>
        <p className="text-sm text-muted">
          Upload a PNG/JPEG/WebP, then click the stuck spot. Coordinates stay normalized to the
          captured image.
        </p>
      </div>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="block w-full text-sm"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {previewUrl && activeArtifact ? (
        <div className="space-y-2">
          <Label>Pin note</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What went wrong here?"
          />
          <button
            type="button"
            className="relative block w-full overflow-hidden rounded-[10px] border border-border p-0"
            onClick={placePin}
            aria-label="Place pin on screenshot"
          >
            <img
              ref={imgRef}
              src={previewUrl}
              alt="Evidence for pin placement"
              className="max-h-[320px] w-full object-contain"
            />
            {pins
              .filter((p) => p.artifactId === activeArtifact)
              .map((p, i) => (
                <span
                  key={`${p.artifactId}-${i}`}
                  className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-canvas bg-action"
                  style={{ left: `${p.xNorm * 100}%`, top: `${p.yNorm * 100}%` }}
                />
              ))}
          </button>
          <p className="text-xs text-muted">Click the image to drop a pin at that spot.</p>
        </div>
      ) : null}
      {pins.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {pins.map((p, i) => (
            <li key={`${p.artifactId}-${i}`} className="flex items-center justify-between gap-2">
              <span>
                Pin {i + 1} · ({p.xNorm.toFixed(2)}, {p.yNorm.toFixed(2)})
                {p.note ? ` — ${p.note}` : ""}
              </span>
              <Button
                variant="ghost"
                className="min-h-[36px] px-2 text-sm"
                onClick={() => onChange(pins.filter((_, idx) => idx !== i))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <Notice title="Evidence upload" tone="danger">
          {error}
        </Notice>
      ) : null}
    </div>
  );
}
