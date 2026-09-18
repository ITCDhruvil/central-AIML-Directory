import { createHash } from "node:crypto";

/** Deterministic content hash used to detect user edits to generated content. */
export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}
