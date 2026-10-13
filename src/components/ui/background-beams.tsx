"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

// Each beam is the same curve shifted 7 right and 8 up from the one before it.
function beamPath(i: number): string {
  const x = (n: number) => n + i * 7;
  const y = (n: number) => n - i * 8;
  return `M${x(-380)} ${y(-189)}C${x(-380)} ${y(-189)} ${x(-312)} ${y(216)} ${x(152)} ${y(343)}C${x(616)} ${y(470)} ${x(684)} ${y(875)} ${x(684)} ${y(875)}`;
}

// A repeatable 0–1 value per beam. It must come out identical on the server and in the browser: Math.random() differs
// every call, and even Math.sin() can differ in its last digits between engines, which breaks hydration. Integer-only
// hashing is exact everywhere.
const seeded = (i: number, salt: number) => {
  let h = (Math.imul(i + 1, 374761393) + Math.imul(salt + 1, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const DEFAULT_VIEWBOX = "0 0 696 316";

/**
 * Animated light beams drifting across a dark surface. Fills its (positioned) parent, so put it inside a relatively
 * positioned element with a dark background. `count` is how many beams to draw: fewer is lighter on small surfaces.
 *
 * Colours: set --beam-1, --beam-2 and --beam-3 (head, middle, tail) on the element or a parent; they default to the
 * original cyan, violet and purple.
 *
 * Each beam's light is a gradient positioned in the visible frame's own coordinates, so the glow always travels across
 * what you can see, however small the box is.
 */
export const BackgroundBeams = React.memo(
  ({
    className,
    count = 50,
    viewBox = DEFAULT_VIEWBOX,
  }: {
    className?: string;
    count?: number;
    /** Which part of the artwork to show. The beams cross in the upper-left, so a wide, short box wants a tighter frame. */
    viewBox?: string;
  }) => {
    const reduceMotion = useReducedMotion();
    const paths = React.useMemo(
      () =>
        Array.from({ length: Math.min(50, Math.max(1, count)) }, (_, i) =>
          beamPath(i),
        ),
      [count],
    );
    const [vx, vy, vw, vh] = React.useMemo(() => {
      const n = viewBox.split(/\s+/).map(Number);
      return n.length === 4 && n.every(Number.isFinite)
        ? n
        : DEFAULT_VIEWBOX.split(" ").map(Number);
    }, [viewBox]);

    return (
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 flex h-full w-full items-center justify-center",
          className,
        )}
      >
        <svg
          className="absolute z-0 h-full w-full"
          width="100%"
          height="100%"
          viewBox={viewBox}
          // "slice" fills the whole box, so a wide, short button is covered edge to edge instead of letterboxed.
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {paths.map((path, index) => (
            <path
              key={`path-${index}`}
              d={path}
              stroke={`url(#beam-gradient-${index})`}
              strokeOpacity="0.9"
              // The artwork is scaled to whatever box it fills, so a fixed viewBox width would shrink to a hairline on a
              // small button. Non-scaling keeps every beam a constant 1.25px.
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <defs>
            {paths.map((_, index) => {
              // The lit band is 30–55% of the frame wide and sweeps from just off the left edge to just off the right.
              const band = vw * (0.3 + seeded(index, 4) * 0.25);
              const startX = vx - band;
              const endX = vx + vw;
              const y = vy + vh * (0.2 + seeded(index, 5) * 0.6);
              const restX = vx + vw * seeded(index, 6) * 0.7;
              return (
                <motion.linearGradient
                  id={`beam-gradient-${index}`}
                  key={`gradient-${index}`}
                  gradientUnits="userSpaceOnUse"
                  y1={y}
                  y2={y + vh * 0.3}
                  initial={{ x1: restX, x2: restX + band }}
                  animate={
                    reduceMotion
                      ? undefined
                      : { x1: [startX, endX], x2: [startX + band, endX + band] }
                  }
                  transition={{
                    duration: seeded(index, 2) * 6 + 5,
                    ease: "easeInOut",
                    repeat: Infinity,
                    delay: seeded(index, 3) * 6,
                  }}
                >
                  <stop
                    style={{ stopColor: "var(--beam-1, #18CCFC)" }}
                    stopOpacity="0"
                  />
                  <stop
                    offset="35%"
                    style={{ stopColor: "var(--beam-1, #18CCFC)" }}
                  />
                  <stop
                    offset="65%"
                    style={{ stopColor: "var(--beam-2, #6344F5)" }}
                  />
                  <stop
                    offset="100%"
                    style={{ stopColor: "var(--beam-3, #AE48FF)" }}
                    stopOpacity="0"
                  />
                </motion.linearGradient>
              );
            })}
          </defs>
        </svg>
      </div>
    );
  },
);

BackgroundBeams.displayName = "BackgroundBeams";
