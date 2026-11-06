// Draws a Mermaid diagram in the browser. mermaid is loaded on first use (it is large) and runs in its strict security
// mode, which sanitises the diagram's text and disables click handlers. Browser only.

let counter = 0;

export async function renderMermaid(code: string): Promise<string> {
  const mermaid = (await import("mermaid")).default;
  const dark = document.documentElement.classList.contains("dark");
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default", fontFamily: "inherit" });
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
