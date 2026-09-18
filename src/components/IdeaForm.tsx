"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { IDEA_STATUSES, type Idea, type IdeaInput } from "@/types/idea";
import type { Technology } from "@/types/technology";
import { TechnologyEditor } from "@/components/TechnologyEditor";
import { Dropdown } from "@/components/ui/Dropdown";
import { OwnerSelect } from "@/components/ui/OwnerSelect";
import { Button } from "@/components/ui/Button";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { cn } from "@/lib/cn";
import { IDEA_STATUS_ICONS } from "@/lib/ideaOptionIcons";

const STATUS_OPTIONS = IDEA_STATUSES.map((s) => ({ value: s, label: s, icon: IDEA_STATUS_ICONS[s].icon, iconClassName: IDEA_STATUS_ICONS[s].className }));

function toCsv(values: string[]): string {
  return values.join(", ");
}

function fromCsv(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function Field({
  label,
  hint,
  span,
  grow,
  children,
}: {
  label: string;
  hint?: string;
  span?: string;
  grow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(span, grow && "flex h-full min-h-0 flex-col")}>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label} {hint && <span className="font-normal text-zinc-400">{hint}</span>}
      </label>
      <div className={cn("mt-1", grow && "flex min-h-0 flex-1 flex-col")}>{children}</div>
    </div>
  );
}

export function IdeaForm({ idea, cancelHref }: { idea?: Idea; cancelHref: string }) {
  const router = useRouter();
  const isEdit = Boolean(idea);

  const [name, setName] = useState(idea?.name ?? "");
  const [description, setDescription] = useState(idea?.description ?? "");
  const [status, setStatus] = useState(idea?.status ?? "ACTIVE");
  const [owner, setOwner] = useState(idea?.owner ?? "");
  const [technologies, setTechnologies] = useState<Technology[]>(idea?.technologies ?? []);
  const [tags, setTags] = useState(toCsv(idea?.tags ?? []));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const payload: IdeaInput = {
      name,
      description: description || null,
      status: status as IdeaInput["status"],
      owner: owner.trim() || null,
      technologies,
      tags: fromCsv(tags),
    };

    try {
      const res = await fetch(isEdit ? `/api/ideas/${idea!.id}` : "/api/ideas", {
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
      router.push(`/ideas/${body.idea.id}`);
      router.refresh();
    } catch {
      setFormError("Network error — please try again");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 lg:min-h-[calc(100vh-8.5rem)]"
    >
      {formError && (
        <p className="mb-5 shrink-0 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {formError}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch lg:gap-6">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Idea Name">
              <input value={name} onChange={(e) => setName(e.target.value)} className="field w-full" />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </Field>

            <Field label="Status">
              <Dropdown value={status} onChange={(v) => setStatus(v as IdeaInput["status"])} options={STATUS_OPTIONS} className="w-full" />
              {errors.status && <p className="mt-1 text-xs text-red-600">{errors.status}</p>}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Owner" hint="(optional)">
              <OwnerSelect value={owner} onChange={setOwner} className="w-full" />
              {errors.owner && <p className="mt-1 text-xs text-red-600">{errors.owner}</p>}
            </Field>

            <Field label="Tags" hint="(comma-separated)">
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="growth, internal-tool" className="field w-full" />
            </Field>
          </div>

          <Field label="Technologies" hint="(optional)">
            <TechnologyEditor value={technologies} onChange={setTechnologies} />
          </Field>
        </div>

        <div className="flex min-h-[20rem] flex-col lg:h-full lg:min-h-0">
          <Field label="Description" hint="(Markdown)" grow>
            <RichTextEditor
              value={description ?? ""}
              onChange={setDescription}
              placeholder="What's the idea? What problem does it solve?"
              className="h-full min-h-[20rem] flex-1 lg:min-h-0"
            />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex shrink-0 gap-2 border-t border-zinc-100 pt-5 dark:border-zinc-800">
        <Button type="submit" variant="primary" icon={Check} loading={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save Changes" : "Add Idea"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push(cancelHref)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
