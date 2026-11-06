"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Boxes,
  Check,
  Code2,
  FileText,
  ListChecks,
  MoreHorizontal,
  Palette,
  Sparkles,
  StickyNote,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { MANUAL_DOCUMENT_CATEGORIES, type DocumentCategory } from "@/types/documentation";
import { useCan } from "@/components/AuthProvider";
import { Loader } from "@/components/prompt-kit/loader";
import { Dropdown } from "@/components/ui/Dropdown";
import { cleanTitle } from "@/lib/ai/cleanTitle";
import { Button } from "@/components/ui/Button";
import { EDITOR_HINT as HINT, RichTextEditor } from "@/components/ui/RichTextEditor";

const CATEGORY_ICONS: Record<DocumentCategory, LucideIcon> = {
  README: FileText,
  SETUP: Wrench,
  ARCHITECTURE: Boxes,
  PRD: FileText,
  PLAN: ListChecks,
  AI_RULES: Bot,
  DESIGN: Palette,
  API: Code2,
  NOTES: StickyNote,
  OTHER: MoreHorizontal,
};

const CATEGORY_OPTIONS = MANUAL_DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: c, icon: CATEGORY_ICONS[c] }));

const LABEL = "block text-[11px] font-medium uppercase tracking-wider text-zinc-400";

export function DocumentForm({
  projectId,
  document,
  cancelHref,
}: {
  projectId: string;
  /** Present when editing an existing manual document. */
  document?: { id: string; title: string; category: DocumentCategory; content: string };
  cancelHref: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(document);

  const [title, setTitle] = useState(document?.title ?? "");
  const [category, setCategory] = useState<DocumentCategory>(document?.category ?? "NOTES");
  const [content, setContent] = useState(document?.content ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canUseAi = useCan("ai_text_transform", "use");
  const [titling, setTitling] = useState(false);
  const [titleHint, setTitleHint] = useState<string | null>(null);

  // Writes a short title from the content. With no content there is nothing to go on, so it asks for some first.
  async function suggestTitle() {
    if (titling) return;
    if (!content.trim()) {
      setTitleHint("Please add some content first.");
      return;
    }
    setTitling(true);
    setTitleHint(null);
    try {
      const res = await fetch("/api/ai/transform-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "title", text: content }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTitleHint(body.error ?? "Could not write a title. Please try again.");
        return;
      }
      const suggested = cleanTitle(typeof body.text === "string" ? body.text : "");
      if (suggested) setTitle(suggested);
      else setTitleHint("Could not write a title. Please try again.");
    } catch {
      setTitleHint("Network error — please try again.");
    } finally {
      setTitling(false);
    }
  }

  const dirty =
    title !== (document?.title ?? "") || category !== (document?.category ?? "NOTES") || content !== (document?.content ?? "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const payload = { title, category, content };
    const url = isEdit
      ? `/api/projects/${projectId}/documents/${document!.id}`
      : `/api/projects/${projectId}/documents`;

    try {
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.details) setErrors(body.details);
        setFormError(body.error ?? "Something went wrong");
        setSubmitting(false);
        return;
      }

      const body = await res.json();
      router.push(`/projects/${projectId}/documents/${body.document.id}`);
      router.refresh();
    } catch {
      setFormError("Network error — please try again");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{formError}</p>
      )}

      <div className="grid grid-cols-1 gap-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-[1fr_14rem]">
        <div className="min-w-0">
          <label htmlFor="doc-title" className={LABEL}>
            Title
          </label>
          <div className="relative mt-1.5">
            <input
              id="doc-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleHint(null);
              }}
              placeholder="Untitled document"
              className={`w-full border-0 border-b border-zinc-200 bg-transparent px-0 pb-2 text-xl font-semibold tracking-tight text-zinc-900 placeholder:text-zinc-300 focus:border-orange-500 focus:outline-none dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-600 ${canUseAi ? "pr-10" : ""}`}
            />
            {canUseAi && (
              <button
                type="button"
                onClick={() => void suggestTitle()}
                disabled={titling}
                aria-label="Write a title with AI"
                title="Write a short title from the content with AI"
                className="absolute bottom-1.5 right-0 flex h-7 w-7 items-center justify-center rounded-md text-orange-600 transition-colors hover:bg-orange-50 disabled:cursor-wait dark:text-orange-400 dark:hover:bg-orange-500/10"
              >
                {titling ? <Loader size={16} /> : <Sparkles size={16} />}
              </button>
            )}
          </div>
          {titleHint && (
            <p role="status" className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
              {titleHint}
            </p>
          )}
          {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
        </div>

        <div>
          <span className={LABEL}>Category</span>
          <Dropdown value={category} onChange={(v) => setCategory(v as DocumentCategory)} options={CATEGORY_OPTIONS} className="mt-1.5 w-full" />
        </div>
      </div>

      <div>
        <span className={`${LABEL} mb-1.5`}>Content</span>
        <RichTextEditor value={content} onChange={setContent} projectId={projectId} placeholder={`Start writing the document… ${HINT}`} className="min-h-[28rem]" />
        {errors.content && <p className="mt-1 text-xs text-red-600">{errors.content}</p>}
      </div>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-100/80 px-1 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <p className="flex items-center gap-2 text-xs text-zinc-400">
          {dirty ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes
            </>
          ) : (
            "No changes yet"
          )}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push(cancelHref)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon={Check} loading={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save changes" : "Create document"}
          </Button>
        </div>
      </div>
    </form>
  );
}
