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
  StickyNote,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { MANUAL_DOCUMENT_CATEGORIES, type DocumentCategory } from "@/types/documentation";
import { Dropdown } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";

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
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {formError}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="field mt-1 w-full" />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Category</label>
        <Dropdown
          value={category}
          onChange={(v) => setCategory(v as DocumentCategory)}
          options={CATEGORY_OPTIONS}
          className="mt-1 w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Content <span className="font-normal text-zinc-400">(Markdown)</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          className="field mt-1 w-full font-mono"
        />
        {errors.content && <p className="mt-1 text-xs text-red-600">{errors.content}</p>}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" variant="primary" icon={Check} loading={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save Changes" : "Create Document"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push(cancelHref)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
