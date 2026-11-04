"use client";

import { useEffect, useState } from "react";
import { Download, File as FileIcon } from "lucide-react";
import { MarkdownView } from "@/components/MarkdownView";
import { SpreadsheetViewer } from "@/components/SpreadsheetViewer";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/prompt-kit/loader";
import { TextShimmer } from "@/components/prompt-kit/text-shimmer";
import type { FilePreview as FilePreviewData } from "@/lib/filePreview";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; preview: FilePreviewData | null };

// The Word preview is untrusted HTML from an uploaded file, so it is shown in a sandboxed frame with no permissions at
// all (no scripts, no forms, no navigation) and given its own readable styles.
const DOCX_STYLES = `
  body { font: 15px/1.65 system-ui, sans-serif; color: #18181b; margin: 0; padding: 32px 40px; max-width: 860px; }
  h1, h2, h3, h4 { line-height: 1.25; margin: 1.4em 0 .5em; }
  p { margin: .6em 0; } img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; margin: 1em 0; } td, th { border: 1px solid #d4d4d8; padding: 6px 10px; }
  a { color: #ea580c; }
`;

/** Loads and shows the in-app preview of an uploaded file: Excel / CSV, Markdown, plain text or Word. */
export function FilePreview({ projectId, documentId, fileName }: { projectId: string; documentId: string; fileName: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const fileUrl = `/api/projects/${projectId}/documents/${documentId}/file`;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/documents/${documentId}/preview`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "The preview could not be loaded.");
        if (!cancelled) setState({ status: "ready", preview: body.preview ?? null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : "The preview could not be loaded." });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, documentId]);

  if (state.status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-zinc-200 py-24 dark:border-zinc-800">
        <Loader size="md" className="text-zinc-400" />
        <TextShimmer className="text-sm">Reading the file…</TextShimmer>
      </div>
    );
  }

  if (state.status === "error" || !state.preview) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 px-6 py-20 text-center dark:border-zinc-700">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
          <FileIcon size={26} />
        </span>
        <p className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {state.status === "error" ? "Preview unavailable" : "No preview for this file type"}
        </p>
        <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          {state.status === "error" ? state.message : "Download it to open it in the right app."}
        </p>
        <Button href={fileUrl} external variant="primary" icon={Download} className="mt-5">
          Download {fileName}
        </Button>
      </div>
    );
  }

  const { preview } = state;

  if (preview.kind === "sheets") return <SpreadsheetViewer sheets={preview.sheets} />;

  if (preview.kind === "docx") {
    return (
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800">
        <iframe
          title={fileName}
          sandbox=""
          srcDoc={`<!doctype html><meta charset="utf-8"><style>${DOCX_STYLES}</style>${preview.html}`}
          className="block h-[calc(100vh-13rem)] min-h-[480px] w-full"
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-6 py-7 dark:border-zinc-800 dark:bg-zinc-900 sm:px-10 sm:py-9">
      {preview.kind === "markdown" ? (
        <MarkdownView content={preview.text} />
      ) : (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm text-zinc-800 dark:text-zinc-200">{preview.text}</pre>
      )}
      {preview.truncated && <p className="mt-4 text-xs text-zinc-400">Showing the first part of the file. Download it for everything.</p>}
    </div>
  );
}
