"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { AlertCircle, AudioLines, Check, ImageIcon, Link2, Loader2, Trash2, UploadCloud, Video, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { buildImageSrc, parseImageSrc } from "@/lib/imageSrc";
import { formatBytes, MAX_MEDIA_BYTES, MEDIA_ACCEPT, safeMediaSrc, type MediaKind } from "@/lib/media";

const KINDS: { kind: MediaKind; label: string; icon: typeof ImageIcon; hint: string }[] = [
  { kind: "image", label: "Image", icon: ImageIcon, hint: "PNG, JPEG, GIF or WebP" },
  { kind: "video", label: "Video", icon: Video, hint: "MP4, WebM or MOV" },
  { kind: "audio", label: "Audio", icon: AudioLines, hint: "MP3, WAV, OGG or M4A" },
];

type Picked = { url: string; name: string; size?: number; local?: string };

/** Sends the file to the server and reports progress (fetch can't, so this uses XHR). */
function upload(file: File, kind: MediaKind, onProgress: (pct: number) => void): Promise<{ url: string; name: string; size: number }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let body: { url?: string; name?: string; size?: number; error?: string; kind?: MediaKind } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // fall through to the generic error
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.url) {
        if (body.kind && body.kind !== kind) reject(new Error(`That file is ${body.kind === "image" ? "an image" : `a ${body.kind} file`}, not ${kind === "image" ? "an image" : `a ${kind}`}. Pick the ${body.kind} tab.`));
        else resolve({ url: body.url, name: body.name ?? file.name, size: body.size ?? file.size });
      } else reject(new Error(body.error ?? "The upload failed. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Network error — please try again."));
    xhr.send(form);
  });
}

/** Add an image, video or audio clip: drop or choose a file (uploaded and stored) or paste a link. */
export function MediaDialog({ editor, initialKind, onClose }: { editor: Editor; initialKind: MediaKind; onClose: () => void }) {
  const editingImage = initialKind === "image" && editor.isActive("image");
  const [kind, setKind] = useState<MediaKind>(initialKind);
  const [mode, setMode] = useState<"upload" | "link">(editingImage ? "link" : "upload");
  const [picked, setPicked] = useState<Picked | null>(
    editingImage ? { url: parseImageSrc((editor.getAttributes("image").src as string) ?? "").base, name: (editor.getAttributes("image").alt as string) ?? "" } : null,
  );
  const [link, setLink] = useState(editingImage ? parseImageSrc((editor.getAttributes("image").src as string) ?? "").base : "");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const localUrl = useRef<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => () => void (localUrl.current && URL.revokeObjectURL(localUrl.current)), []);

  const meta = KINDS.find((k) => k.kind === kind)!;

  function switchKind(next: MediaKind) {
    setKind(next);
    setPicked(null);
    setLink("");
    setError(null);
    setProgress(null);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_MEDIA_BYTES) {
      setError(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_MEDIA_BYTES)}.`);
      return;
    }
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    const local = URL.createObjectURL(file);
    localUrl.current = local;
    setPicked({ url: "", name: file.name, size: file.size, local });
    setProgress(0);
    try {
      const done = await upload(file, kind, setProgress);
      setPicked({ url: done.url, name: done.name, size: done.size, local });
    } catch (e) {
      setPicked(null);
      setError(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setProgress(null);
    }
  }

  function applyLink() {
    const src = safeMediaSrc(link);
    if (!src) {
      setError("Use an address that starts with http:// or https://.");
      return;
    }
    setError(null);
    setPicked({ url: src, name: src.startsWith("/api/media/") ? meta.label : src.split("/").pop()?.split("?")[0] || "link" });
  }

  function insert() {
    if (!picked?.url) return;
    const name = picked.name.replace(/\.[a-z0-9]{2,5}$/i, "") && picked.name;
    if (kind === "image") {
      if (editingImage) {
        // A new picture keeps the old one's size and alignment, but not its crop.
        const { opts } = parseImageSrc((editor.getAttributes("image").src as string) ?? "");
        const src = buildImageSrc(parseImageSrc(picked.url).base, { w: opts.w, a: opts.a });
        editor.chain().focus().updateAttributes("image", { src, alt: name }).run();
      }
      else editor.chain().focus().setImage({ src: picked.url, alt: name }).run();
    } else {
      editor.chain().focus().insertContent({ type: "media", attrs: { kind, src: picked.url, name } }).run();
    }
    onClose();
  }

  const preview = picked?.local ?? picked?.url;
  const uploading = progress !== null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Add media" className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Add to note</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        <div className="mx-5 mt-3 grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => switchKind(k.kind)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition-colors",
                kind === k.kind ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
              )}
            >
              <k.icon size={14} />
              {k.label}
            </button>
          ))}
        </div>

        <div className="mx-5 mt-3 flex gap-4 border-b border-zinc-200 text-sm dark:border-zinc-800">
          {([["upload", "Upload", UploadCloud], ["link", "Link", Link2]] as const).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 pb-2",
                mode === m ? "border-orange-500 text-zinc-900 dark:text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="px-5 py-4">
          {picked ? (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-center bg-zinc-50 dark:bg-zinc-950/50">
                {kind === "image" && preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="max-h-56 w-auto max-w-full object-contain" />
                )}
                {kind === "video" && preview && <video src={preview} controls className="max-h-56 w-full" />}
                {kind === "audio" && preview && <audio src={preview} controls className="m-4 w-full" />}
              </div>
              <div className="flex items-center gap-3 border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{picked.name || "Selected file"}</p>
                  <p className="text-xs text-zinc-500">
                    {uploading ? `Uploading… ${progress}%` : picked.size ? formatBytes(picked.size) : "From a link"}
                  </p>
                </div>
                {uploading ? (
                  <Loader2 size={16} className="animate-spin text-orange-500" />
                ) : (
                  <>
                    <Check size={16} className="text-emerald-500" />
                    <button type="button" onClick={() => setPicked(null)} aria-label="Remove" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800">
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
              {uploading && (
                <div className="h-1 bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full bg-orange-500 transition-[width]" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          ) : mode === "upload" ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void handleFile(e.dataTransfer.files[0]);
              }}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-9 text-center transition-colors",
                dragging ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10" : "border-zinc-300 dark:border-zinc-700",
              )}
            >
              <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <meta.icon size={20} />
              </span>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Drop {kind === "image" ? "an image" : `a ${kind} file`} here</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {meta.hint} · up to {formatBytes(MAX_MEDIA_BYTES)}
              </p>
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="mt-3 rounded-lg bg-orange-500 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-orange-600"
              >
                Choose file
              </button>
              <input ref={input} type="file" accept={MEDIA_ACCEPT[kind]} className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">{meta.label} address</label>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyLink()}
                  placeholder="https://…"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-orange-400 dark:border-zinc-700"
                />
                <button type="button" onClick={applyLink} className="rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  Preview
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Cancel
          </button>
          <button
            type="button"
            disabled={!picked?.url || uploading}
            onClick={insert}
            className="rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {editingImage ? "Update" : "Insert"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
