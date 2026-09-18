import {
  TEXT_TRANSFORM_SYSTEM_PROMPT,
  buildTextTransformUserMessage,
  type TextTransformPromptInput,
} from "@/lib/ai/textTransformPrompts";
import { parseTextTransformResponse } from "@/lib/ai/textTransformValidator";
import type { AIConfig, GenerateFn } from "@/lib/ai/types";

export class TextTransformResponseError extends Error {}

/**
 * Rewrites whatever text is currently in an editor per one instruction
 * (improve / fix grammar / shorten / lengthen / tone) — opt-in, triggered
 * only from a toolbar click, replaces the field's content for the user to
 * keep or undo. `generate` is injected so this is testable without network access.
 */
export async function transformText(
  input: TextTransformPromptInput,
  config: AIConfig,
  generate: GenerateFn,
): Promise<string> {
  const userMessage = buildTextTransformUserMessage(input);
  const raw = await generate(TEXT_TRANSFORM_SYSTEM_PROMPT, userMessage, config);

  const parsed = parseTextTransformResponse(raw);
  if (!parsed) {
    throw new TextTransformResponseError("The AI returned a response that could not be understood");
  }

  return parsed.text;
}
