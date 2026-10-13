import { BrandLogo } from "@/components/BrandLogo";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen items-center justify-center overflow-y-auto bg-zinc-100 px-4 py-10 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-lg bg-white p-7 shadow-[0_1px_2px_rgba(24,24,27,0.04),0_12px_32px_rgba(24,24,27,0.06)] ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
        <div className="mb-6 flex items-center gap-3">
          <BrandLogo size={38} priority />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputClass =
  "h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

export const buttonClass =
  "h-10 w-full rounded-md bg-orange-600 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60";
