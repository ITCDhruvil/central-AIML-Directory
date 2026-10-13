/**
 * A lightbulb that is switched on: the usual bulb outline with a soft inner glow and four short light rays.
 * Takes the same props as a lucide icon so it can sit next to them (size, strokeWidth, className); colour comes from
 * `currentColor`.
 */
export function GlowBulbIcon({
  size = 24,
  strokeWidth = 2,
  className,
}: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* soft glow inside the glass */}
      <path
        d="M15 15c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 9c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5Z"
        fill="currentColor"
        fillOpacity={0.18}
        stroke="none"
      />
      {/* bulb outline, base and cap */}
      <path d="M15 15c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 9c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18.5h6" />
      <path d="M10 22h4" />
      {/* light rays */}
      <path d="M2 8.5h1.5" />
      <path d="M20.5 8.5H22" />
      <path d="M4.2 2.7l1.1 1.1" />
      <path d="M19.8 2.7l-1.1 1.1" />
    </svg>
  );
}
