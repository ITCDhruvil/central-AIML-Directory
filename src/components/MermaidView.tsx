"use client";

import { useEffect, useRef, useState } from "react";
import { renderMermaid } from "@/lib/mermaidClient";

/** Draws a ```mermaid block; shows the plain code if the diagram can't be drawn. */
export function MermaidView({ code }: { code: string }) {
  const box = useRef<HTMLDivElement>(null);
  // Remember which code failed, so changing the code tries again without resetting state in an effect.
  const [failedCode, setFailedCode] = useState<string | null>(null);
  const failed = failedCode === code;

  useEffect(() => {
    let live = true;
    renderMermaid(code)
      .then((svg) => {
        // mermaid's strict mode has already sanitised this SVG.
        if (live && box.current) box.current.innerHTML = svg;
      })
      .catch(() => live && setFailedCode(code));
    return () => {
      live = false;
    };
  }, [code]);

  if (failed) {
    return (
      <pre>
        <code>{code}</code>
      </pre>
    );
  }
  return <div ref={box} className="my-3 flex justify-center overflow-x-auto text-zinc-500" aria-label="Diagram" />;
}
