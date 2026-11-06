"use client";

import { useEffect, useState, type ReactNode, type Ref } from "react";
import { parseImageSrc } from "@/lib/imageSrc";

/**
 * An image with the size, alignment and crop stored in its link (see lib/imageSrc.ts). Shared by the editor, which
 * layers resize handles and a toolbar on top through `children`, and by the Markdown renderer.
 */
export function ImageFigure({
  src,
  alt,
  widthOverride,
  ignoreCrop,
  figureRef,
  children,
}: {
  src: string;
  alt?: string;
  widthOverride?: number;
  ignoreCrop?: boolean;
  figureRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
}) {
  const { base, opts } = parseImageSrc(src);
  const crop = ignoreCrop ? undefined : opts.c;
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!crop) return;
    const probe = new window.Image();
    probe.onload = () => setNat({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.src = base;
  }, [base, crop]);

  const width = widthOverride ?? opts.w ?? (crop ? Math.min(640, nat ? Math.round(crop.w * nat.w) : 480) : undefined);
  const justify = opts.a === "r" ? "flex-end" : opts.a === "c" ? "center" : "flex-start";

  return (
    <div className="my-3 flex" style={{ justifyContent: justify }}>
      <div ref={figureRef} className="relative max-w-full" style={{ width }}>
        {crop ? (
          <div className="relative overflow-hidden rounded-lg" style={{ aspectRatio: nat ? `${crop.w * nat.w} / ${crop.h * nat.h}` : "16 / 10" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={base}
              alt={alt ?? ""}
              draggable={false}
              className="absolute max-w-none select-none"
              style={{ width: `${100 / crop.w}%`, height: `${100 / crop.h}%`, left: `${(-crop.x / crop.w) * 100}%`, top: `${(-crop.y / crop.h) * 100}%` }}
            />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={base} alt={alt ?? ""} draggable={false} className="block h-auto max-w-full rounded-lg select-none" style={{ width: width ? "100%" : undefined }} />
        )}
        {children}
      </div>
    </div>
  );
}
