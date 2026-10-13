import { test } from "node:test";
import assert from "node:assert/strict";
import { CHATBOT_TOOLS } from "@/lib/ai/chatbotToolDefs";

function tool(name: string) {
  const found = CHATBOT_TOOLS.find((item) => item.function.name === name);
  assert.ok(found, `missing chatbot tool ${name}`);
  return found!.function;
}

test("chatbot can list/search every schema model", () => {
  for (const name of [
    "list_projects",
    "get_project",
    "list_ideas",
    "get_idea",
    "list_insights",
    "get_insight",
    "list_owners",
    "list_documents",
    "get_document",
    "list_activity",
    "search_workspace",
  ]) {
    tool(name);
  }
});

test("list_projects q searches the whole project schema, with extra filters", () => {
  const fn = tool("list_projects");
  assert.match(fn.description, /every project field/i);
  const props = fn.parameters.properties as Record<string, { description?: string }>;
  assert.match(props.q?.description ?? "", /technolog/i);
  assert.match(props.q?.description ?? "", /tag/i);
  assert.match(props.q?.description ?? "", /github/i);
  assert.match(props.q?.description ?? "", /documentation/i);
  assert.ok("stage" in props);
  assert.ok("tag" in props);
  assert.ok("technology" in props);
});

test("list_ideas q searches the whole idea schema", () => {
  const fn = tool("list_ideas");
  const props = fn.parameters.properties as Record<string, { description?: string }>;
  assert.match(props.q?.description ?? "", /technolog/i);
  assert.match(props.q?.description ?? "", /tag/i);
  assert.ok("tag" in props);
  assert.ok("technology" in props);
});

test("list_insights and list_documents accept a free-text q across their fields", () => {
  const insights = tool("list_insights");
  const docs = tool("list_documents");
  const insightProps = insights.parameters.properties as Record<string, { description?: string }>;
  const docProps = docs.parameters.properties as Record<string, { description?: string }>;
  assert.match(insightProps.q?.description ?? "", /reasoning/i);
  assert.match(docProps.q?.description ?? "", /content/i);
});

test("search_workspace is the cross-schema lookup", () => {
  const fn = tool("search_workspace");
  assert.match(fn.description, /projects/i);
  assert.match(fn.description, /ideas/i);
  assert.match(fn.description, /document/i);
  assert.match(fn.description, /insight/i);
  const props = fn.parameters.properties as Record<string, unknown>;
  assert.ok("q" in props);
});
