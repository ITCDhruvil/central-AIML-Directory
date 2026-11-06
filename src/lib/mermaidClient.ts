// Draws a Mermaid diagram in the browser. mermaid is loaded on first use (it is large) and runs in its strict security
// mode, which sanitises the diagram's text and disables click handlers. Browser only.

let counter = 0;

// A fixed font, so the text is measured and drawn with the same one (with "inherit" the labels were cut off).
export const DIAGRAM_FONT = "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";

export async function renderMermaid(code: string): Promise<string> {
  const mermaid = (await import("mermaid")).default;
  const dark = document.documentElement.classList.contains("dark");
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default", fontFamily: DIAGRAM_FONT });
  const id = `mmd-${Date.now()}-${counter++}`;
  try {
    const { svg } = await mermaid.render(id, code);
    return svg;
  } catch (error) {
    // A failed render leaves a stray error element in the page.
    document.getElementById(`d${id}`)?.remove();
    throw error;
  }
}
