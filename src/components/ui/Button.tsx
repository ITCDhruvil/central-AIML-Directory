import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerSolid";
export type ButtonSize = "sm" | "md";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-orange-600 text-white hover:bg-orange-500 dark:bg-orange-500 dark:hover:bg-orange-400 disabled:hover:bg-orange-600 dark:disabled:hover:bg-orange-500",
  secondary:
    "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800",
  ghost: "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
  danger:
    "border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950",
  dangerSolid: "bg-red-600 text-white hover:bg-red-500",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "gap-1.5 rounded-md px-2.5 py-1.5 text-xs",
  md: "gap-1.5 rounded-md px-3 py-2 text-sm",
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16 };

/** Accepts lucide icons as well as our own inline-SVG icon components (e.g. GithubIcon) — anything shaped like `(props: { size?, className? }) => ReactElement`. */
export type IconType = React.ElementType<{ size?: number; className?: string }>;

interface SharedProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconType;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const BASE_CLASSES =
  "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50";

function ButtonIcon({ icon: Icon, loading, size }: { icon?: IconType; loading?: boolean; size: ButtonSize }) {
  if (loading) return <Loader2 size={ICON_SIZE[size]} className="animate-spin" />;
  if (Icon) return <Icon size={ICON_SIZE[size]} />;
  return null;
}

type LinkProps = Omit<React.ComponentProps<typeof Link>, "className" | "children"> & { external?: false };
type AnchorProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href"> & {
  href: string;
  external: true;
};
type ButtonElementProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
  href?: undefined;
  external?: undefined;
};

type ButtonProps = SharedProps & (LinkProps | AnchorProps | ButtonElementProps);

/** The app's one reusable interactive control — a plain button, an internal Link, or an external anchor, all sharing the same look. */
export function Button({ variant = "secondary", size = "md", icon, loading, className, children, ...rest }: ButtonProps) {
  const classes = cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className);
  const iconEl = <ButtonIcon icon={icon} loading={loading} size={size} />;

  if ("external" in rest && rest.external) {
    const anchorProps: Record<string, unknown> = { ...rest };
    delete anchorProps.external;
    return (
      <a {...anchorProps} target="_blank" rel="noopener noreferrer" className={classes}>
        {iconEl}
        {children}
      </a>
    );
  }

  if ("href" in rest && rest.href !== undefined) {
    const linkProps: Record<string, unknown> = { ...rest };
    delete linkProps.external;
    return (
      <Link {...(linkProps as LinkProps)} className={classes}>
        {iconEl}
        {children}
      </Link>
    );
  }

  const buttonProps = rest as ButtonElementProps;
  return (
    <button type="button" {...buttonProps} disabled={buttonProps.disabled || loading} className={classes}>
      {iconEl}
      {children}
    </button>
  );
}
