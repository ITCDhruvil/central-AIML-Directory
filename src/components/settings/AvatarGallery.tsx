"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Shuffle } from "lucide-react";
import { Loader } from "@/components/prompt-kit/loader";
import { Button } from "@/components/ui/Button";
import { AVATAR_SIZE_PX } from "@/lib/avatar";
import { cn } from "@/lib/cn";

// All of these styles are CC0 (public domain), so no attribution is needed. They are drawn locally by DiceBear: no
// request leaves the browser to make a picture.
const STYLES = [
  { id: "lorelei", label: "Portraits" },
  { id: "notionists", label: "Sketch" },
  { id: "openPeeps", label: "Peeps" },
  { id: "thumbs", label: "Thumbs" },
  { id: "shapes", label: "Shapes" },
  { id: "rings", label: "Rings" },
  { id: "glass", label: "Glass" },
] as const;

type StyleId = (typeof STYLES)[number]["id"];

const BACKGROUNDS = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf"];
const COUNT = 12;

type DiceBear = { core: typeof import("@dicebear/core"); collection: typeof import("@dicebear/collection") };

/** Draws the chosen SVG into a square PNG. Only these pixels are uploaded, never the SVG. */
async function toPng(dataUri: string): Promise<Blob> {
  const img = new Image();
  img.src = dataUri;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE_PX;
  canvas.height = AVATAR_SIZE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't prepare the picture.");
  ctx.drawImage(img, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't prepare the picture."))), "image/png"),
  );
}

/**
 * Pick a ready-made profile picture instead of uploading a photo: choose a style, shuffle for more, click one and save.
 * The first picture is drawn from your own name, so it is always the same for you.
 */
export function AvatarGallery({ name, onCancel, onSaved }: { name: string; onCancel: () => void; onSaved: () => void }) {
  const router = useRouter();
  const [lib, setLib] = useState<DiceBear | null>(null);
  const [styleId, setStyleId] = useState<StyleId>("lorelei");
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The library is only loaded when the gallery opens, so it adds nothing to the settings page otherwise.
  useEffect(() => {
    let cancelled = false;
    Promise.all([import("@dicebear/core"), import("@dicebear/collection")])
      .then(([core, collection]) => {
        if (!cancelled) setLib({ core, collection });
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the avatar library. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(() => {
    if (!lib) return [];
    const style = lib.collection[styleId];
    return Array.from({ length: COUNT }, (_, i) => {
      const seed = i === 0 && round === 0 ? name || "me" : `${styleId}-${round}-${i}`;
      const avatar = lib.core.createAvatar(style as Parameters<typeof lib.core.createAvatar>[0], {
        seed,
        size: AVATAR_SIZE_PX,
        backgroundColor: BACKGROUNDS,
      });
      return { seed, uri: avatar.toDataUri() };
    });
  }, [lib, styleId, round, name]);

  async function save() {
    if (!picked) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await toPng(picked);
      const res = await fetch("/api/account/avatar", { method: "PUT", headers: { "Content-Type": blob.type }, body: blob });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Couldn't save the picture.");
        return;
      }
      router.refresh(); // the sidebar and menus read the picture's version from the server
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Avatar style">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === styleId}
            onClick={() => {
              setStyleId(s.id);
              setRound(0);
              setPicked(null);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              s.id === styleId
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
            )}
          >
            {s.label}
          </button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          icon={Shuffle}
          className="ml-auto"
          onClick={() => {
            setRound((r) => r + 1);
            setPicked(null);
          }}
        >
          Shuffle
        </Button>
      </div>

      {!lib && !error ? (
        <div className="flex h-40 items-center justify-center text-zinc-400">
          <Loader size="md" />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {options.map((o) => {
            const isPicked = picked === o.uri;
            return (
              <button
                key={o.seed}
                type="button"
                onClick={() => setPicked(o.uri)}
                aria-label="Choose this avatar"
                aria-pressed={isPicked}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-full ring-2 ring-offset-2 transition focus-visible:outline-none ring-offset-white dark:ring-offset-zinc-900",
                  isPicked ? "ring-orange-500" : "ring-transparent hover:ring-zinc-300 dark:hover:ring-zinc-600",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.uri} alt="" draggable={false} className="h-full w-full" />
                {isPicked && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
                    <Check size={20} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" disabled={!picked} loading={saving} onClick={() => void save()}>
          Use this avatar
        </Button>
        <Button variant="ghost" size="sm" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
