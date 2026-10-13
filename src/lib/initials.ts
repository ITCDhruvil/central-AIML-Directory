/** "Ada Lovelace" → "AL", "Ada" → "A". Used for avatar circles. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
  return letters.toUpperCase();
}
