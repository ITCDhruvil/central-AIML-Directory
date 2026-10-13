"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Maximize2, Minimize2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { AVATAR_SIZE_PX } from "@/lib/avatar";
import {
  MAX_ZOOM,
  dragCrop,
  minZoom,
  placement,
  zoomCrop,
  type Crop,
} from "@/lib/avatarCrop";
import {
  loadPicture,
  releasePicture,
  renderAvatar,
  type LoadedPicture,
} from "@/lib/resizeImage";
import type { AuthUser } from "@/lib/auth/types";

/** The framing window on screen, in CSS pixels. What you see inside the circle is exactly what is saved. */
const FRAME_PX = 200;

/**
 * Change or remove your own profile picture. Choosing a file opens a framing step: drag the picture to reposition it,
 * zoom with the slider or mouse wheel, or "Fit whole picture" so nothing is cut off. Nothing changes until you save.
 */
export function AvatarEditor({ user, name }: { user: AuthUser; name: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [picture, setPicture] = useState<LoadedPicture | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState<"preparing" | "saving" | "removing" | null>(
    null,
  );
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const drag = useRef<{ startX: number; startY: number; crop: Crop } | null>(
    null,
  );

  // Release the picture (and its temporary URL) when it is replaced or the editor goes away.
  useEffect(() => {
    return () => {
      if (picture) releasePicture(picture);
    };
  }, [picture]);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so choosing the same file again still fires
    if (!file) return;
    setMessage(null);
    setBusy("preparing");
    try {
      setPicture(await loadPicture(file));
      setCrop({ zoom: 1, x: 0, y: 0 });
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof Error ? error.message : "Couldn't use that picture.",
      });
    } finally {
      setBusy(null);
    }
  }

  function cancel() {
    setPicture(null);
    setMessage(null);
  }

  async function save() {
    if (!picture) return;
    setBusy("saving");
    setMessage(null);
    try {
      const blob = await renderAvatar(picture, crop, AVATAR_SIZE_PX);
      const res = await fetch("/api/account/avatar", {
        method: "PUT",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage({
          kind: "error",
          text: body.error ?? "Couldn't save the picture.",
        });
        return;
      }
      setPicture(null);
      setMessage({ kind: "ok", text: "Profile picture updated." });
      router.refresh(); // the sidebar and menus read the picture's version from the server
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof Error ? error.message : "Network error. Try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("removing");
    setMessage(null);
    try {
      const res = await fetch("/api/account/avatar", { method: "DELETE" });
      if (!res.ok) {
        setMessage({ kind: "error", text: "Couldn't remove the picture." });
        return;
      }
      setMessage({ kind: "ok", text: "Profile picture removed." });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Network error. Try again." });
    } finally {
      setBusy(null);
    }
  }

  const hasPicture = user.avatarVersion !== null;
  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      onChange={onPick}
      className="sr-only"
      aria-label="Choose a profile picture"
      tabIndex={-1}
    />
  );

  const status = (
    <>
      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={
            message.kind === "error"
              ? "text-xs text-red-600 dark:text-red-400"
              : "text-xs text-emerald-600 dark:text-emerald-400"
          }
        >
          {message.text}
        </p>
      )}
    </>
  );

  // ---- framing step
  if (picture) {
    const p = placement(picture.width, picture.height, crop);
    const floor = minZoom(picture.width, picture.height);
    const fitted = Math.abs(crop.zoom - floor) < 0.005;

    return (
      <div className="space-y-3">
        {fileInput}
        <div className="flex flex-wrap items-start gap-5">
          {/* The frame: a circle showing exactly what will be saved. Drag to move, scroll to zoom. */}
          <div
            role="img"
            aria-label="Position your picture inside the circle. Drag to move it."
            className="relative shrink-0 cursor-grab touch-none select-none overflow-hidden rounded-full ring-2 ring-orange-400 active:cursor-grabbing"
            // The same edge colour that fills the gaps when saved, so what you see is what you get.
            style={{
              width: FRAME_PX,
              height: FRAME_PX,
              backgroundColor: picture.edgeColor,
            }}
            onPointerDown={(e) => {
              drag.current = { startX: e.clientX, startY: e.clientY, crop };
              try {
                // Keeps the drag going if the pointer slips outside the circle.
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // not capturable: dragging still works while the pointer stays over the frame
              }
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const d = drag.current;
              setCrop(
                dragCrop(
                  d.crop,
                  (e.clientX - d.startX) / FRAME_PX,
                  (e.clientY - d.startY) / FRAME_PX,
                  picture.width,
                  picture.height,
                ),
              );
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={(e) =>
              setCrop((c) =>
                zoomCrop(
                  c,
                  c.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08),
                  picture.width,
                  picture.height,
                ),
              )
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={picture.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{
                left: p.dx * FRAME_PX,
                top: p.dy * FRAME_PX,
                width: p.dw * FRAME_PX,
                height: p.dh * FRAME_PX,
              }}
            />
          </div>

          <div className="min-w-48 flex-1 space-y-3">
            <div>
              <label
                htmlFor="avatar-zoom"
                className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Zoom
              </label>
              <input
                id="avatar-zoom"
                type="range"
                min={floor}
                max={MAX_ZOOM}
                step={0.01}
                value={crop.zoom}
                onChange={(e) =>
                  setCrop((c) =>
                    zoomCrop(
                      c,
                      Number(e.target.value),
                      picture.width,
                      picture.height,
                    ),
                  )
                }
                className="mt-1 w-full accent-orange-600"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={fitted ? Maximize2 : Minimize2}
                onClick={() =>
                  setCrop(
                    fitted
                      ? { zoom: 1, x: 0, y: 0 }
                      : { zoom: floor, x: 0, y: 0 },
                  )
                }
              >
                {fitted ? "Fill the circle" : "Fit whole picture"}
              </Button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Drag the picture to move it. Scroll or use the slider to zoom.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={busy === "saving"}
                onClick={() => void save()}
              >
                Save picture
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy === "saving"}
                onClick={cancel}
              >
                Cancel
              </Button>
            </div>
            {status}
          </div>
        </div>
      </div>
    );
  }

  // ---- normal state
  return (
    <div className="flex items-center gap-4">
      <Avatar user={{ ...user, name }} size={80} className="text-2xl" />

      <div className="min-w-0 space-y-2">
        {fileInput}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Camera}
            disabled={busy !== null}
            onClick={() => input.current?.click()}
          >
            {busy === "preparing"
              ? "Preparing…"
              : hasPicture
                ? "Change photo"
                : "Upload photo"}
          </Button>
          {hasPicture && (
            <Button
              variant="ghost"
              size="sm"
              icon={busy === "removing" ? Loader2 : Trash2}
              disabled={busy !== null}
              onClick={() => void remove()}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          JPEG, PNG or WebP. You can position and zoom it before saving.
        </p>
        {status}
      </div>
    </div>
  );
}
