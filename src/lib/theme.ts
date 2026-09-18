export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const listeners = new Set<() => void>();

/** The exact logic baked into the inline no-flash script in layout.tsx — keep the two in sync. */
export const THEME_INIT_SCRIPT = `(function(){try{var v=localStorage.getItem("${STORAGE_KEY}");var m=v==="dark"||v==="light"||v==="system"?v:"light";var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "light";
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "dark" || value === "system" ? value : "light";
}

/** For useSyncExternalStore — a stable, hydration-safe way to read the client-only stored preference. */
export function subscribeTheme(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Persists the choice, applies it immediately to the current page, and notifies subscribers (e.g. the Settings page). */
export function applyTheme(theme: ThemePreference): void {
  window.localStorage.setItem(STORAGE_KEY, theme);
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
  listeners.forEach((listener) => listener());
}
