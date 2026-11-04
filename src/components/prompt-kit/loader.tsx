import { cn } from "@/lib/cn";

const SIZES = { sm: 16, md: 22, lg: 32 } as const;

/**
 * The app's one loader: the "classic" spinner (twelve bars fading round a circle). It draws in `currentColor`, so it
 * matches the text colour of whatever it sits in. `size` is a preset or a pixel size.
 */
export function Loader({ size = "md", className }: { size?: keyof typeof SIZES | number; className?: string }) {
  const px = typeof size === "number" ? size : SIZES[size];
  return (
    <span role="status" aria-label="Loading" className={cn("relative inline-block shrink-0", className)} style={{ width: px, height: px }}>
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className="absolute inset-0" style={{ transform: `rotate(${i * 30}deg)` }}>
          <span
            className="loader-bar mx-auto block h-[26%] w-[9%] rounded-full bg-current"
            style={{ animationDelay: `${-1.2 + i * 0.1}s` }}
          />
        </span>
      ))}
    </span>
  );
}
