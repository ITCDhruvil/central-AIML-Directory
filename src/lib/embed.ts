// Embeds (YouTube, Vimeo, Loom, Figma): only these providers may be framed, and the frame address is always built here
// from the pasted link, never taken from it directly. Pure so the editor, the Markdown renderer and the tests share it.

export type EmbedInfo = { provider: "youtube" | "vimeo" | "loom" | "figma"; src: string; ratio: string };

const ID = /^[\w-]{6,40}$/;

export function embedSource(raw: string): EmbedInfo | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = parts[0] === "watch" ? url.searchParams.get("v") : ["embed", "shorts", "live"].includes(parts[0] ?? "") ? parts[1] : null;
    if (id && /^[\w-]{11}$/.test(id)) return { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}`, ratio: "16 / 9" };
    return null;
  }
  if (host === "youtu.be") {
    const id = parts[0];
    return id && /^[\w-]{11}$/.test(id) ? { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}`, ratio: "16 / 9" } : null;
  }
  if (host === "vimeo.com") {
    const id = parts[0];
    return id && /^\d{5,12}$/.test(id) ? { provider: "vimeo", src: `https://player.vimeo.com/video/${id}`, ratio: "16 / 9" } : null;
  }
  if (host === "loom.com") {
    const id = parts[0] === "share" || parts[0] === "embed" ? parts[1] : null;
    return id && ID.test(id) ? { provider: "loom", src: `https://www.loom.com/embed/${id}`, ratio: "16 / 9" } : null;
  }
  if (host === "figma.com") {
    if (["file", "design", "proto", "board"].includes(parts[0] ?? "")) {
      const link = `https://www.figma.com${url.pathname}${url.search}`;
      return { provider: "figma", src: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(link)}`, ratio: "4 / 3" };
    }
  }
  return null;
}

/** Markdown has no embeds, so one is stored as an image whose description is "embed": ![embed](https://youtu.be/…). */
export const EMBED_ALT = "embed";
