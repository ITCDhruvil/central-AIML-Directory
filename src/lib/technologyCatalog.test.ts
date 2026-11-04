import { test } from "node:test";
import assert from "node:assert/strict";
import { inferTechnologyCategory } from "@/lib/technologyCatalog";
import { normalizeTechnologiesInput } from "@/lib/validation";

test("well-known technologies get their category, case-insensitively", () => {
  assert.equal(inferTechnologyCategory("Python"), "LANGUAGE");
  assert.equal(inferTechnologyCategory("fastapi"), "FRAMEWORK");
  assert.equal(inferTechnologyCategory("Uvicorn"), "RUNTIME");
  assert.equal(inferTechnologyCategory("SQL Server"), "DATABASE");
  assert.equal(inferTechnologyCategory("Azure OpenAI"), "AI_ML");
  assert.equal(inferTechnologyCategory("Azure Container Apps"), "CLOUD");
  assert.equal(inferTechnologyCategory("OpenTelemetry"), "TOOL");
  assert.equal(inferTechnologyCategory("Totally Made Up Thing"), "OTHER");
});

test("plain names are categorised, and an explicit category is kept as given", () => {
  const result = normalizeTechnologiesInput(["Python", "Mystery", { name: "Python 3", category: "RUNTIME" }]);
  assert.deepEqual(
    result.map((t) => [t.name, t.category]),
    [
      ["Python", "LANGUAGE"],
      ["Mystery", "OTHER"],
      ["Python 3", "RUNTIME"],
    ],
  );
});
