import { cn } from "@/lib/cn";

/** Shared card frame for the settings sections. */
export function SettingsCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
    >
      <header className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        )}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}
