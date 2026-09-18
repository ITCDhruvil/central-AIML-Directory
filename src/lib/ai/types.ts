import type { DocumentCategory } from "@/types/documentation";

/** A project document reduced to what the context builder needs — decoupled from the Prisma-backed Documentation shape so this module stays a pure function of plain data. */
export interface ContextDocument {
  documentId: string;
  title: string;
  category: DocumentCategory;
  content: string;
}

/** A document that made it into the context sent to the model, with its stable citation label. */
export interface ContextSource {
  label: string;
  documentId: string;
  title: string;
  category: DocumentCategory;
}

/** A document that did not fit in the context budget — the model must be told about it explicitly. */
export interface OmittedDocument {
  documentId: string;
  title: string;
  category: DocumentCategory;
}

export interface BuiltContext {
  /** The document-derived portion of the prompt, ready to embed after a project summary. */
  contextText: string;
  /** Documents actually included, in citation-label order. */
  sources: ContextSource[];
  /** Documents that did not fit within the character budget and were left out entirely. */
  omitted: OmittedDocument[];
  /** Label of the one document (if any) whose content was cut short to fit the budget. */
  truncatedLabel: string | null;
}

export interface AIConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
}

/** The shape returned to the browser. Citations are always server-validated against `sources`. */
export interface AssistantAnswer {
  answer: string;
  citations: Array<{ documentId: string; title: string; category: DocumentCategory }>;
}

export class AIProviderError extends Error {}

/** The model call is injected so the orchestration in assistant.ts is testable without any network access. */
export type GenerateFn = (systemPrompt: string, userMessage: string, config: AIConfig) => Promise<string>;
