import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// The shadcn-style components in components/ui/shadcn rely on this: it joins class names and lets a later Tailwind
// class win over an earlier conflicting one (so `p-0` overrides the component's default `p-4`). The app's own
// lib/cn.ts is a plain join and stays as it is.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
