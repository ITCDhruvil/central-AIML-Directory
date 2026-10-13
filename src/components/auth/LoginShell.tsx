import { BookOpen, FolderOpen, Lightbulb, type LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { BrandName, BrandTagline } from "@/components/BrandingProvider";

function Brand({ size = "lg" }: { size?: "md" | "lg" }) {
  return (
    <div className="flex items-center gap-4">
      <BrandLogo size={size === "lg" ? 52 : 46} priority />
      <span aria-hidden className="h-10 w-px bg-zinc-200 dark:bg-zinc-700" />
      <div className="leading-tight">
        <div className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          <BrandName />
        </div>
        <div className="text-[15px] text-zinc-500 dark:text-zinc-400">
          <BrandTagline />
        </div>
      </div>
    </div>
  );
}

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: FolderOpen,
    title: "Project Directory",
    text: "Find and explore internal AI/ML projects",
  },
  {
    icon: BookOpen,
    title: "Documentation",
    text: "Access guides, setup steps and resources",
  },
  {
    icon: Lightbulb,
    title: "AI-Powered Assistant",
    text: "Get instant answers with project knowledge",
  },
];

function HeroPanel() {
  return (
    <aside className="relative hidden flex-col gap-12 overflow-hidden bg-gradient-to-br from-orange-50 via-[#fff4ec] to-[#fffaf6] px-16 py-16 lg:flex dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
      {/* decorative shapes */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-orange-200/40 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-orange-100/70"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-orange-600"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-20 left-1/3 h-[22rem] w-[22rem] rounded-full border border-orange-200/60"
      />

      <div className="relative">
        <Brand />
      </div>

      <div className="relative my-auto max-w-xl space-y-8">
        <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-zinc-900 dark:text-zinc-50">
          Explore. Build. Innovate.
          <span className="block text-orange-600">Together.</span>
        </h1>
        <p className="max-w-md text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Discover and manage AI/ML projects, all in one place.
        </p>
        <ul className="space-y-5 pt-2">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-100/80 text-orange-600 dark:bg-orange-500/15">
                <Icon size={22} strokeWidth={1.6} />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
                  {title}
                </span>
                <span className="block text-sm text-zinc-500 dark:text-zinc-400">
                  {text}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/** Two-column sign-in layout: brand/marketing panel on large screens, form card on the right. */
export function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-y-auto bg-[#fdfaf8] font-sans dark:bg-zinc-950">
      <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
        <HeroPanel />

        <main className="relative flex items-center justify-center overflow-hidden px-4 py-12 sm:px-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full border-[28px] border-orange-300/70"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-6 top-1/3 hidden h-28 w-28 opacity-60 sm:block"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgb(251 146 60 / 0.55) 1.5px, transparent 1.6px)",
              backgroundSize: "16px 16px",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-orange-100/70"
          />

          <div className="relative w-full max-w-[34rem] rounded-lg bg-white p-8 shadow-[0_1px_2px_rgba(24,24,27,0.04),0_24px_60px_-12px_rgba(24,24,27,0.12)] ring-1 ring-zinc-950/5 sm:p-11 dark:bg-zinc-900 dark:ring-white/10">
            {/* The left panel already shows the brand on large screens, so the card only needs it below that. */}
            <div className="mb-9 lg:hidden">
              <Brand size="md" />
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
