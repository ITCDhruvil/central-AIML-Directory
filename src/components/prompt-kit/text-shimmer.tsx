"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * Text with a soft highlight sweeping across it, for "working on it" labels. `baseColor` is the resting text colour
 * and `peakColor` the highlight; leave them out to use the page's zinc defaults (light and dark), or pass both when
 * the text sits on a coloured background such as a primary button.
 */
export function TextShimmer({
  children,
  className,
  duration = 2.4,
  spread = 14,
  baseColor,
  peakColor,
}: {
  children: string;
  className?: string;
  /** Seconds for one sweep. */
  duration?: number;
  /** Highlight width per character, in px. */
  spread?: number;
  baseColor?: string;
  peakColor?: string;
}) {
  const reduceMotion = useReducedMotion();
  const width = children.length * spread;

  const style = {
    ...(baseColor ? { "--shimmer-base": baseColor } : {}),
    ...(peakColor ? { "--shimmer-peak": peakColor } : {}),
    backgroundImage: `linear-gradient(90deg, transparent calc(50% - ${width}px), var(--shimmer-peak), transparent calc(50% + ${width}px)), linear-gradient(var(--shimmer-base), var(--shimmer-base))`,
    backgroundSize: "250% 100%, auto",
    backgroundRepeat: "no-repeat, padding-box",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  } as CSSProperties;

  return (
    <motion.span
      className={cn("inline-block [--shimmer-base:#a1a1aa] [--shimmer-peak:#18181b] dark:[--shimmer-base:#71717a] dark:[--shimmer-peak:#fafafa]", className)}
      style={style}
      initial={{ backgroundPosition: "100% center" }}
      animate={reduceMotion ? undefined : { backgroundPosition: "0% center" }}
      transition={{ repeat: Infinity, duration, ease: "linear" }}
    >
      {children}
    </motion.span>
  );
}
