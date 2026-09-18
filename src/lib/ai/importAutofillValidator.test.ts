import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImportAutofillResponse } from "@/lib/ai/importAutofillValidator";
import { buildImportAutofillUserMessage } from "@/lib/ai/importAutofillPrompts";

test("parseImportAutofillResponse: name target", () => {
  const parsed = parseImportAutofillResponse(JSON.stringify({ name: "  Widgets App  " }), "name");
  assert.deepEqual(parsed, { target: "name", name: "Widgets App" });
});

test("parseImportAutofillResponse: description target rejects missing field", () => {
  assert.equal(parseImportAutofillResponse(JSON.stringify({ name: "x" }), "description"), null);
});

test("parseImportAutofillResponse: tags target dedupes and caps", () => {
  const parsed = parseImportAutofillResponse(
    JSON.stringify({ tags: ["api", " API ", "dashboard", "x", "y", "z", "a", "b"] }),
    "tags",
  );
  assert.ok(parsed && parsed.target === "tags");
  assert.deepEqual(parsed.tags, ["api", "dashboard", "x", "y", "z", "a"]);
});

test("parseImportAutofillResponse: technologies target", () => {
  const parsed = parseImportAutofillResponse(
    JSON.stringify({ suggestedTechnologies: ["React", "react", ""] }),
    "technologies",
  );
  assert.deepEqual(parsed, { target: "technologies", suggestedTechnologies: ["React"] });
});

test("parseImportAutofillResponse: all target requires every field", () => {
  assert.equal(
    parseImportAutofillResponse(JSON.stringify({ name: "W", description: "D", tags: [] }), "all"),
    null,
  );
  const parsed = parseImportAutofillResponse(
    JSON.stringify({
      name: "Widgets",
      description: "A toolkit",
      tags: ["tools", "api"],
      suggestedTechnologies: ["React"],
    }),
    "all",
  );
  assert.deepEqual(parsed, {
    target: "all",
    name: "Widgets",
    description: "A toolkit",
    tags: ["tools", "api"],
    suggestedTechnologies: ["React"],
  });
});

test("buildImportAutofillUserMessage includes onlyFill list for all target", () => {
  const message = buildImportAutofillUserMessage({
    repoFullName: "acme/widgets",
    target: "all",
    existingName: "widgets",
    existingDescription: null,
    existingTags: [],
    readme: "# Widgets",
    detectedTechnologies: ["TypeScript"],
    onlyFill: ["description", "tags"],
  });
  assert.match(message, /Target field to fill: all/);
  assert.match(message, /Only fill these empty fields: description, tags/);
});

test("buildImportAutofillUserMessage includes target and current field context", () => {
  const message = buildImportAutofillUserMessage({
    repoFullName: "acme/widgets",
    target: "tags",
    existingName: "widgets",
    existingDescription: "A widget toolkit",
    existingTags: ["tools"],
    readme: "# Widgets\nUses React.",
    detectedTechnologies: ["TypeScript"],
  });
  assert.match(message, /Target field to fill: tags/);
  assert.match(message, /Current tags: tools/);
  assert.match(message, /Already detected technologies: TypeScript/);
  assert.match(message, /README:/);
});
