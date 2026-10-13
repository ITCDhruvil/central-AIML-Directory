// Browser-safe: how wide the chat panel may be, and where its width is remembered.

export const DEFAULT_CHAT_WIDTH = 512;
export const MIN_CHAT_WIDTH = 360;
/** The widest the panel can ever be (on a big enough window). Safe to render, unlike anything read from the window. */
export const ABSOLUTE_MAX_CHAT_WIDTH = 1000;
/** The panel sits this far from the right edge of the window. */
export const CHAT_RIGHT_GAP = 10;
/** Always leave a strip of the page visible on the left. */
const PAGE_STRIP = 120;

/** One entry per person, so a shared browser keeps each account's own choice. */
export const chatWidthKey = (userId: string) => `chatbot-width:${userId}`;

export function maxChatWidth(viewportWidth: number): number {
  return Math.max(MIN_CHAT_WIDTH, Math.min(ABSOLUTE_MAX_CHAT_WIDTH, viewportWidth - PAGE_STRIP));
}

export function clampChatWidth(px: number, viewportWidth: number): number {
  if (!Number.isFinite(px)) return DEFAULT_CHAT_WIDTH;
  return Math.round(Math.min(maxChatWidth(viewportWidth), Math.max(MIN_CHAT_WIDTH, px)));
}

/** A saved width, or null when there is none or it isn't a usable number. */
export function parseStoredChatWidth(raw: string | null | undefined, viewportWidth: number): number | null {
  if (raw === null || raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? clampChatWidth(n, viewportWidth) : null;
}

/** The width that puts the panel's left edge under the pointer. */
export function widthFromPointer(clientX: number, viewportWidth: number): number {
  return viewportWidth - CHAT_RIGHT_GAP - clientX;
}
