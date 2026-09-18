import {
  IMPORT_AUTOFILL_SYSTEM_PROMPT,
  buildImportAutofillUserMessage,
  type AutofillFieldTarget,
  type AutofillTarget,
} from "@/lib/ai/importAutofillPrompts";
import { parseImportAutofillResponse, type ParsedImportAutofill } from "@/lib/ai/importAutofillValidator";
import type { AIConfig, GenerateFn } from "@/lib/ai/types";

export class ImportAutofillResponseError extends Error {}

export interface ImportAutofillInput {
  repoFullName: string;
  target: AutofillTarget;
  existingName: string | null;
  existingDescription: string | null;
  existingTags: string[];
  readme: string;
  detectedTechnologies: string[];
  onlyFill?: AutofillFieldTarget[];
}

/**
 * Opt-in per-field autofill — only runs when the user clicks a field AI button.
 * Prefills one form field for review; never saves anything itself.
 * `generate` is injected so this is testable without network access.
 */
export async function autofillProjectImport(
  input: ImportAutofillInput,
  config: AIConfig,
  generate: GenerateFn,
): Promise<ParsedImportAutofill> {
  const userMessage = buildImportAutofillUserMessage({
    repoFullName: input.repoFullName,
    target: input.target,
    existingName: input.existingName,
    existingDescription: input.existingDescription,
    existingTags: input.existingTags,
    readme: input.readme,
    detectedTechnologies: input.detectedTechnologies,
    onlyFill: input.onlyFill,
  });
  const raw = await generate(IMPORT_AUTOFILL_SYSTEM_PROMPT, userMessage, config);

  const parsed = parseImportAutofillResponse(raw, input.target);
  if (!parsed) {
    throw new ImportAutofillResponseError("The AI returned a response that could not be understood");
  }

  return parsed;
}
