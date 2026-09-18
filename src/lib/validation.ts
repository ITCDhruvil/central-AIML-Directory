import {
  PROJECT_STAGES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  type ProjectInput,
  type ProjectStage,
} from "@/types/project";
import { IDEA_STATUSES, type IdeaInput } from "@/types/idea";
import { DOCUMENT_CATEGORIES, DOCUMENT_SOURCES, type DocumentCategory, type DocumentSource } from "@/types/documentation";
import { CONFIDENCE_LEVELS, TECHNOLOGY_CATEGORIES, type Technology } from "@/types/technology";
import { sha256 } from "@/lib/hash";
import type { ChatCompletionMessage, ChatToolCall } from "@/lib/ai/chatTypes";

export class ValidationError extends Error {
  constructor(public readonly errors: Record<string, string>) {
    super("Validation failed");
  }
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function toStringArray(value: unknown, field: string, errors: Record<string, string>): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    errors[field] = `${field} must be an array of strings`;
    return [];
  }
  return value.map((v) => v.trim()).filter(Boolean);
}

export function validateProjectInput(body: unknown): ProjectInput {
  const errors: Record<string, string> = {};

  if (typeof body !== "object" || body === null) {
    throw new ValidationError({ body: "Request body must be an object" });
  }
  const data = body as Record<string, unknown>;

  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) {
    errors.name = "name is required";
  }

  const type = typeof data.type === "string" ? data.type : "";
  if (!PROJECT_TYPES.includes(type as (typeof PROJECT_TYPES)[number])) {
    errors.type = `type must be one of ${PROJECT_TYPES.join(", ")}`;
  }

  const status = typeof data.status === "string" ? data.status : "";
  if (!PROJECT_STATUSES.includes(status as (typeof PROJECT_STATUSES)[number])) {
    errors.status = `status must be one of ${PROJECT_STATUSES.join(", ")}`;
  }

  const description =
    typeof data.description === "string" && data.description.trim() ? data.description.trim() : null;

  const owner =
    typeof data.owner === "string" && data.owner.trim() ? data.owner.trim() : null;

  let stage: ProjectStage | null = null;
  if (typeof data.stage === "string" && data.stage.trim()) {
    if (!PROJECT_STAGES.includes(data.stage as ProjectStage)) {
      errors.stage = `stage must be one of ${PROJECT_STAGES.join(", ")}`;
    } else {
      stage = data.stage as ProjectStage;
    }
  }

  const githubUrl =
    typeof data.githubUrl === "string" && data.githubUrl.trim() ? data.githubUrl.trim() : null;
  if (githubUrl && !isValidUrl(githubUrl)) {
    errors.githubUrl = "githubUrl must be a valid URL";
  }

  const githubOwner =
    typeof data.githubOwner === "string" && data.githubOwner.trim() ? data.githubOwner.trim() : null;
  const githubRepo =
    typeof data.githubRepo === "string" && data.githubRepo.trim() ? data.githubRepo.trim() : null;
  const defaultBranch =
    typeof data.defaultBranch === "string" && data.defaultBranch.trim() ? data.defaultBranch.trim() : null;

  const technologies = normalizeTechnologiesInput(data.technologies);
  const tags = toStringArray(data.tags, "tags", errors);
  const deploymentUrls = toStringArray(data.deploymentUrls, "deploymentUrls", errors);

  for (const url of deploymentUrls) {
    if (!isValidUrl(url)) {
      errors.deploymentUrls = `invalid URL: ${url}`;
      break;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }

  return {
    name,
    description,
    type: type as ProjectInput["type"],
    status: status as ProjectInput["status"],
    stage,
    owner,
    githubUrl,
    githubOwner,
    githubRepo,
    defaultBranch,
    technologies,
    tags,
    deploymentUrls,
  };
}

/**
 * Normalizes the `technologies` field of a project create/update request.
 * Accepts either structured Technology objects (from a GitHub import or a
 * prior save) or plain strings (manual entry) — never throws, silently drops
 * malformed individual entries, and dedupes by lowercased name.
 */
export function normalizeTechnologiesInput(value: unknown): Technology[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: Technology[] = [];

  for (const item of value) {
    let candidate: Technology | null = null;

    if (typeof item === "string") {
      const name = item.trim();
      if (name) candidate = { name, category: "OTHER", evidence: [], confidence: "MEDIUM" };
    } else if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      const name = typeof obj.name === "string" ? obj.name.trim() : "";
      if (name) {
        const category = TECHNOLOGY_CATEGORIES.includes(obj.category as Technology["category"])
          ? (obj.category as Technology["category"])
          : "OTHER";
        const confidence = CONFIDENCE_LEVELS.includes(obj.confidence as Technology["confidence"])
          ? (obj.confidence as Technology["confidence"])
          : "MEDIUM";
        const evidence = Array.isArray(obj.evidence)
          ? obj.evidence.filter((e): e is string => typeof e === "string")
          : [];
        candidate = { name, category, evidence, confidence };
      }
    }

    if (candidate) {
      const key = candidate.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(candidate);
      }
    }
  }

  return result;
}

export function validateIdeaInput(body: unknown): IdeaInput {
  const errors: Record<string, string> = {};

  if (typeof body !== "object" || body === null) {
    throw new ValidationError({ body: "Request body must be an object" });
  }
  const data = body as Record<string, unknown>;

  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) {
    errors.name = "name is required";
  }

  const status = typeof data.status === "string" ? data.status : "";
  if (!IDEA_STATUSES.includes(status as (typeof IDEA_STATUSES)[number])) {
    errors.status = `status must be one of ${IDEA_STATUSES.join(", ")}`;
  }

  const description =
    typeof data.description === "string" && data.description.trim() ? data.description.trim() : null;

  const owner = typeof data.owner === "string" && data.owner.trim() ? data.owner.trim() : null;

  const technologies = normalizeTechnologiesInput(data.technologies);
  const tags = toStringArray(data.tags, "tags", errors);

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }

  return {
    name,
    description,
    status: status as IdeaInput["status"],
    owner,
    technologies,
    tags,
  };
}

export interface ValidatedDocument {
  title: string;
  category: DocumentCategory;
  filePath: string;
  content: string;
  source: DocumentSource;
  /** sha256 of the pristine generated text, only set for source="generated". */
  generatedFromContentHash: string | null;
}

/** Validates the optional `documents` array accompanying a project create request. */
export function validateDocumentsInput(value: unknown): ValidatedDocument[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ValidationError({ documents: "documents must be an array" });
  }

  return value.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new ValidationError({ documents: `documents[${index}] must be an object` });
    }
    const doc = item as Record<string, unknown>;

    const filePath = typeof doc.filePath === "string" ? doc.filePath.trim() : "";
    if (!filePath) {
      throw new ValidationError({ documents: `documents[${index}].filePath is required` });
    }

    const title = typeof doc.title === "string" && doc.title.trim() ? doc.title.trim() : filePath;
    const category = DOCUMENT_CATEGORIES.includes(doc.category as DocumentCategory)
      ? (doc.category as DocumentCategory)
      : "OTHER";
    const content = typeof doc.content === "string" ? doc.content : "";
    const source: DocumentSource = DOCUMENT_SOURCES.includes(doc.source as DocumentSource)
      ? (doc.source as DocumentSource)
      : "github";

    const generatedFromContentHash =
      source === "generated"
        ? sha256(typeof doc.generatedFromContent === "string" ? doc.generatedFromContent : content)
        : null;

    return { title, category, filePath, content, source, generatedFromContentHash };
  });
}

export const MAX_MANUAL_DOCUMENT_TITLE_LENGTH = 200;
export const MAX_MANUAL_DOCUMENT_CONTENT_LENGTH = 200_000; // ~200KB — generous for hand-written Markdown notes

export interface ManualDocumentInput {
  title: string;
  category: DocumentCategory;
  content: string;
}

/** Validates a manually-created/edited document (title/category/content only — never filePath/source, which the server controls). */
export function validateManualDocumentInput(body: unknown): ManualDocumentInput {
  const errors: Record<string, string> = {};

  if (typeof body !== "object" || body === null) {
    throw new ValidationError({ body: "Request body must be an object" });
  }
  const data = body as Record<string, unknown>;

  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) {
    errors.title = "title is required";
  } else if (title.length > MAX_MANUAL_DOCUMENT_TITLE_LENGTH) {
    errors.title = `title must be ${MAX_MANUAL_DOCUMENT_TITLE_LENGTH} characters or fewer`;
  }

  const content = typeof data.content === "string" ? data.content : "";
  if (!content.trim()) {
    errors.content = "content is required";
  } else if (content.length > MAX_MANUAL_DOCUMENT_CONTENT_LENGTH) {
    errors.content = `content must be ${MAX_MANUAL_DOCUMENT_CONTENT_LENGTH} characters or fewer`;
  }

  const category = DOCUMENT_CATEGORIES.includes(data.category as DocumentCategory)
    ? (data.category as DocumentCategory)
    : "OTHER";

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }

  return { title, category, content };
}

export const MAX_ASSISTANT_QUESTION_LENGTH = 500;

/** Validates the question sent to the project assistant. The browser sends only this string — never raw document content. */
export function validateAssistantQuestion(body: unknown): string {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError({ body: "Request body must be an object" });
  }
  const data = body as Record<string, unknown>;

  const question = typeof data.question === "string" ? data.question.trim() : "";
  if (!question) {
    throw new ValidationError({ question: "question is required" });
  }
  if (question.length > MAX_ASSISTANT_QUESTION_LENGTH) {
    throw new ValidationError({ question: `question must be ${MAX_ASSISTANT_QUESTION_LENGTH} characters or fewer` });
  }

  return question;
}

export const MAX_CHAT_MESSAGES = 40;
export const MAX_CHAT_MESSAGE_LENGTH = 4000;

/**
 * Validates the running conversation the chatbot's browser client sends back
 * each turn. Messages round-trip through the browser (the server sent them
 * back after the previous turn), so this only bounds shape and size rather
 * than re-deriving trust — tool_calls/tool_call_id are passed through as-is.
 */
export function validateChatMessages(body: unknown): ChatCompletionMessage[] {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError({ body: "Request body must be an object" });
  }
  const data = body as Record<string, unknown>;

  if (!Array.isArray(data.messages) || data.messages.length === 0) {
    throw new ValidationError({ messages: "messages is required and must be a non-empty array" });
  }
  if (data.messages.length > MAX_CHAT_MESSAGES) {
    throw new ValidationError({ messages: `messages must be ${MAX_CHAT_MESSAGES} or fewer — start a new chat` });
  }

  return data.messages.map((raw, index) => {
    if (typeof raw !== "object" || raw === null) {
      throw new ValidationError({ messages: `messages[${index}] must be an object` });
    }
    const m = raw as Record<string, unknown>;

    if (m.role !== "user" && m.role !== "assistant" && m.role !== "tool") {
      throw new ValidationError({ messages: `messages[${index}].role must be user, assistant, or tool` });
    }
    if (m.content !== null && m.content !== undefined && typeof m.content !== "string") {
      throw new ValidationError({ messages: `messages[${index}].content must be a string or null` });
    }
    if (typeof m.content === "string" && m.content.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new ValidationError({ messages: `messages[${index}].content must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer` });
    }
    if (m.role === "tool" && typeof m.tool_call_id !== "string") {
      throw new ValidationError({ messages: `messages[${index}].tool_call_id is required for tool messages` });
    }

    const message: ChatCompletionMessage = {
      role: m.role,
      content: typeof m.content === "string" ? m.content : null,
    };
    if (Array.isArray(m.tool_calls)) message.tool_calls = m.tool_calls as ChatToolCall[];
    if (typeof m.tool_call_id === "string") message.tool_call_id = m.tool_call_id;
    return message;
  });
}
