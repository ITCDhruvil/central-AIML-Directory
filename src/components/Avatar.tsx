"use client";

import { useState } from "react";
import { avatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/initials";

/**
 * A person's picture, or their initials when they have none (or it fails to load). Pass `className` for the colours of
 * the initials circle and any ring or border; `size` is in pixels.
 */
export function Avatar({
  user,
  size = 32,
  className,
}: {
  user: { id: string; name: string; avatarVersion?: number | null };
  size?: number;
  className?: string;
}) {
  const url = avatarUrl(user.id, user.avatarVersion);
  // Remember which URL failed, so a newly uploaded picture (a new URL) gets a fresh try.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = url !== null && url !== failedUrl;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-100 font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.38)),
      }}
    >
      {showImage ? (
        // A plain <img>: the picture comes from our own authenticated endpoint, so Next's image optimiser can't fetch it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          draggable={false}
          onError={() => setFailedUrl(url)}
          className="h-full w-full object-cover"
        />
      ) : (
        initials(user.name)
      )}
    </span>
  );
}
