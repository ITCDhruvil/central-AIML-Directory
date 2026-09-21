import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  return <nav aria-label="Breadcrumb" className={className} {...props} />;
}

export function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      className={cn("flex flex-wrap items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400", className)}
      {...props}
    />
  );
}

export function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("inline-flex items-center gap-1", className)} {...props} />;
}

export function BreadcrumbLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn("transition-colors hover:text-zinc-900 dark:hover:text-zinc-100", className)}
      {...props}
    />
  );
}

export function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-current="page"
      className={cn("font-medium text-zinc-900 dark:text-zinc-100", className)}
      {...props}
    />
  );
}

export function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      role="presentation"
      aria-hidden
      className={cn("flex items-center text-zinc-400 dark:text-zinc-500", className)}
      {...props}
    >
      {children ?? <ChevronRight size={14} strokeWidth={2} />}
    </span>
  );
}
