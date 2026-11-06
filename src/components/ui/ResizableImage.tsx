"use client";

import { useRef, useState } from "react";
import { Image } from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { AlignCenter, AlignLeft, AlignRight, Check, Crop, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";
import { ImageFigure } from "@/components/ImageFigure";
import { buildImageSrc, parseImageSrc, type ImageAlign, type ImageCrop, type ImageOpts } from "@/lib/imageSrc";
import { cn } from "@/lib/cn";

type Corner = "nw" | "ne" | "sw" | "se";
const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];
const cornerPos: Record<Corner, string> = {
  nw: "-left-1.5 -top-1.5 cursor-nwse-resize",
  ne: "-right-1.5 -top-1.5 cursor-nesw-resize",
  sw: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
  se: "-bottom-1.5 -right-1.5 cursor-nwse-resize",
};
const MIN_W = 60;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function ImageNodeView({ node, editor, selected, updateAttributes, deleteNode }: NodeViewProps) {
  const src = String(node.attrs.src ?? "");
  const { base, opts } = parseImageSrc(src);
  const figure = useRef<HTMLDivElement>(null);
  const [liveW, setLiveW] = useState<number | null>(null);
  const [crop, setCrop] = useState<{ rect: ImageCrop; fullW: number } | null>(null);
  const editable = editor.isEditable;

  const maxWidth = () => {
    const pm = editor.view.dom as HTMLElement;
    const cs = getComputedStyle(pm);
    return Math.round(pm.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  };

  /** Writes size / alignment / crop back into the image link (null clears one). */
  function patch(change: { w?: number | null; a?: ImageAlign | null; c?: ImageCrop | null }) {
    const next: ImageOpts = { ...opts };
    if (change.w !== undefined) {
      if (change.w === null) delete next.w;
      else next.w = change.w;
    }
    if (change.a !== undefined) {
      if (change.a === null) delete next.a;
      else next.a = change.a;
    }
    if (change.c !== undefined) {
      if (change.c === null) delete next.c;
      else next.c = change.c;
    }
    updateAttributes({ src: buildImageSrc(base, next) });
  }

  function startResize(corner: Corner, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const el = figure.current;
    if (!el) return;
    const startX = e.clientX;
    const startW = el.getBoundingClientRect().width;
    const dir = corner === "ne" || corner === "se" ? 1 : -1;
    // A centred image grows from its middle, so the pointer moves twice as far as the edge does.
    const factor = opts.a === "c" ? 2 : 1;
    const limit = maxWidth();
    let w = startW;
    const move = (ev: PointerEvent) => {
      w = clamp(startW + dir * (ev.clientX - startX) * factor, MIN_W, limit);
      setLiveW(w);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLiveW(null);
      patch({ w: Math.round(w) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startCrop() {
    const el = figure.current;
    if (!el) return;
    const shown = el.getBoundingClientRect().width;
    const fullW = opts.c ? shown / opts.c.w : shown;
    setCrop({ fullW, rect: opts.c ?? { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } });
  }

  function dragCrop(kind: "move" | Corner, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const box = figure.current?.getBoundingClientRect();
    if (!box || !crop) return;
    const start = crop.rect;
    const sx = e.clientX;
    const sy = e.clientY;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / box.width;
      const dy = (ev.clientY - sy) / box.height;
      let { x, y, w, h } = start;
      if (kind === "move") {
        x = clamp(start.x + dx, 0, 1 - w);
        y = clamp(start.y + dy, 0, 1 - h);
      } else {
        const right = start.x + start.w;
        const bottom = start.y + start.h;
        if (kind === "nw" || kind === "sw") x = clamp(start.x + dx, 0, right - 0.05);
        if (kind === "ne" || kind === "se") w = clamp(start.w + dx, 0.05, 1 - start.x);
        if (kind === "nw" || kind === "sw") w = right - x;
        if (kind === "nw" || kind === "ne") y = clamp(start.y + dy, 0, bottom - 0.05);
        if (kind === "sw" || kind === "se") h = clamp(start.h + dy, 0.05, 1 - start.y);
        if (kind === "nw" || kind === "ne") h = bottom - y;
      }
      setCrop((c) => (c ? { ...c, rect: { x, y, w, h } } : c));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function applyCrop() {
    if (!crop) return;
    const { rect, fullW } = crop;
    const whole = rect.x < 0.005 && rect.y < 0.005 && rect.w > 0.99 && rect.h > 0.99;
    patch({ c: whole ? null : rect, w: Math.round(rect.w * fullW) });
    setCrop(null);
  }

  const showTools = selected && editable && !crop && liveW === null;
  const btn = "flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/15";
  const presets: [string, number][] = [["S", 0.25], ["M", 0.5], ["L", 0.75]];

  return (
    <NodeViewWrapper contentEditable={false} data-drag-handle>
      <ImageFigure
        src={src}
        alt={node.attrs.alt}
        widthOverride={crop ? crop.fullW : (liveW ?? undefined)}
        ignoreCrop={!!crop}
        figureRef={figure}
      >
        {selected && editable && !crop && (
          <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-orange-500">
            {CORNERS.map((c) => (
              <span
                key={c}
                onPointerDown={(e) => startResize(c, e)}
                className={cn("pointer-events-auto absolute h-3 w-3 rounded-sm border-2 border-white bg-orange-500 shadow", cornerPos[c])}
              />
            ))}
          </div>
        )}

        {showTools && (
          <div
            onMouseDown={(e) => e.preventDefault()}
            className="absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg bg-zinc-900/90 p-1 text-white shadow-xl backdrop-blur"
          >
            {([["l", AlignLeft, "Align left"], ["c", AlignCenter, "Align center"], ["r", AlignRight, "Align right"]] as const).map(([a, Icon, title]) => (
              <button key={a} type="button" title={title} aria-label={title} onClick={() => patch({ a })} className={cn(btn, (opts.a ?? "l") === a && "bg-white/20 text-orange-300")}>
                <Icon size={15} />
              </button>
            ))}
            <span className="mx-0.5 h-4 w-px bg-white/20" />
            {presets.map(([label, ratio]) => (
              <button key={label} type="button" title={`${ratio * 100}% width`} onClick={() => patch({ w: Math.round(maxWidth() * ratio) })} className={cn(btn, "text-xs font-semibold")}>
                {label}
              </button>
            ))}
            <button type="button" title="Full width" onClick={() => patch({ w: maxWidth() })} className={cn(btn, "w-auto px-1.5 text-xs font-semibold")}>
              Full
            </button>
            <span className="mx-0.5 h-4 w-px bg-white/20" />
            <button type="button" title="Crop" aria-label="Crop" onClick={startCrop} className={btn}>
              <Crop size={15} />
            </button>
            <button type="button" title="Replace image" aria-label="Replace image" onClick={() => editor.view.dom.dispatchEvent(new CustomEvent("open-media", { detail: { kind: "image" } }))} className={btn}>
              <RefreshCw size={14} />
            </button>
            <button type="button" title="Reset size and crop" aria-label="Reset size and crop" onClick={() => patch({ w: null, c: null, a: null })} className={btn}>
              <RotateCcw size={14} />
            </button>
            <button type="button" title="Delete" aria-label="Delete image" onClick={() => deleteNode()} className={cn(btn, "text-red-300")}>
              <Trash2 size={15} />
            </button>
          </div>
        )}

        {crop && (
          <>
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
              <div
                className="absolute"
                style={{
                  left: `${crop.rect.x * 100}%`,
                  top: `${crop.rect.y * 100}%`,
                  width: `${crop.rect.w * 100}%`,
                  height: `${crop.rect.h * 100}%`,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                }}
              />
            </div>
            <div
              onPointerDown={(e) => dragCrop("move", e)}
              className="absolute cursor-move border-2 border-white"
              style={{ left: `${crop.rect.x * 100}%`, top: `${crop.rect.y * 100}%`, width: `${crop.rect.w * 100}%`, height: `${crop.rect.h * 100}%` }}
            >
              {CORNERS.map((c) => (
                <span key={c} onPointerDown={(e) => dragCrop(c, e)} className={cn("absolute h-3.5 w-3.5 rounded-sm border-2 border-white bg-orange-500", cornerPos[c])} />
              ))}
            </div>
            <div onMouseDown={(e) => e.preventDefault()} className="absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-zinc-900/90 p-1 text-xs font-medium text-white shadow-xl">
              <button type="button" onClick={applyCrop} className="flex h-7 items-center gap-1 rounded-md bg-orange-500 px-2 hover:bg-orange-600">
                <Check size={14} /> Apply
              </button>
              <button type="button" onClick={() => setCrop((c) => (c ? { ...c, rect: { x: 0, y: 0, w: 1, h: 1 } } : c))} className="flex h-7 items-center rounded-md px-2 hover:bg-white/15">
                Whole image
              </button>
              <button type="button" onClick={() => setCrop(null)} className="flex h-7 items-center gap-1 rounded-md px-2 hover:bg-white/15">
                <X size={14} /> Cancel
              </button>
            </div>
          </>
        )}
      </ImageFigure>
    </NodeViewWrapper>
  );
}

/** The editor's image: click to select, drag to move, drag a corner to resize, and a floating bar for align / size / crop. */
export const ResizableImage = Image.extend({
  draggable: true,
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
