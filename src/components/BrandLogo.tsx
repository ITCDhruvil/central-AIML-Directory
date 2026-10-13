import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * The product mark (transparent PNG in /public). Use this everywhere a logo is needed so there is one source of truth.
 * `white` is the single-colour version for sitting on the orange assistant button. Decorative: the product name is
 * always written next to it, so it is hidden from screen readers.
 */
export function BrandLogo({
  size = 32,
  white = false,
  className,
  priority = false,
}: {
  size?: number;
  white?: boolean;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={white ? "/logo-white.png" : "/logo.png"}
      alt=""
      aria-hidden
      width={size}
      height={size}
      priority={priority}
      draggable={false}
      className={cn("shrink-0 select-none", className)}
    />
  );
}
