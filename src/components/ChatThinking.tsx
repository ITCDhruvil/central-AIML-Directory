"use client";

import { useEffect, useState } from "react";

// What to say, and from how many seconds in. The server answers in one piece (no streaming), so it can't report which
// step it is on; the wording follows how long the wait has been, so a slow request reads as slow rather than stuck.
const PHASES: { from: number; text: string }[] = [
  { from: 0, text: "Thinking…" },
  { from: 3, text: "Looking through your workspace…" },
  { from: 8, text: "Putting it together…" },
  { from: 20, text: "Still working on it…" },
];

/** The wait indicator while a reply is on its way: italic text with a light sweeping across it, no icon and no bubble. */
export function ChatThinking() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      500,
    );
    return () => window.clearInterval(timer);
  }, []);

  const phase =
    [...PHASES].reverse().find((p) => seconds >= p.from) ?? PHASES[0];

  return (
    <div role="status" aria-live="polite" className="px-1 py-1">
      {/* Keyed so each new wording fades in instead of snapping. */}
      <span key={phase.text} className="text-shimmer view-fade text-sm italic">
        {phase.text}
      </span>
    </div>
  );
}
