"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectForm } from "@/components/ProjectForm";
import { GitHubImportPanel } from "@/components/GitHubImportPanel";
import { GitHubImportPreview } from "@/components/GitHubImportPreview";
import type { GitHubImportResult } from "@/types/github";
import type { ProjectInput } from "@/types/project";
import type { DocumentInput } from "@/types/documentation";

function toInitialValues(
  result: GitHubImportResult,
  displayName: string,
  displayDescription: string,
): Partial<ProjectInput> {
  return {
    name: displayName || result.repository.name,
    description: displayDescription.trim() ? displayDescription : null,
    githubUrl: result.repository.htmlUrl,
    githubOwner: result.repository.owner,
    githubRepo: result.repository.name,
    defaultBranch: result.repository.defaultBranch,
    technologies: result.technologies,
  };
}

export default function NewProjectPage() {
  return (
    <Suspense>
      <NewProjectPageContent />
    </Suspense>
  );
}

function NewProjectPageContent() {
  const searchParams = useSearchParams();
  const prefilledGithubUrl = searchParams.get("githubUrl");
  const prefilledName = searchParams.get("name");
  const [importResult, setImportResult] = useState<GitHubImportResult | null>(null);
  const [importedAt, setImportedAt] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [displayDescription, setDisplayDescription] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [setupGuideContent, setSetupGuideContent] = useState("");
  const [includeSetupGuide, setIncludeSetupGuide] = useState(true);
  const formSectionRef = useRef<HTMLDivElement>(null);

  function handleImported(result: GitHubImportResult) {
    setImportResult(result);
    setImportedAt(new Date().toISOString());
    setDisplayName(result.repository.name);
    setDisplayDescription(result.repository.description ?? "");
    setSetupGuideContent(result.setupGuide.content);
    setIncludeSetupGuide(true);
    setFormKey((key) => key + 1);
  }

  function handleDisplayNameChange(name: string) {
    setDisplayName(name);
  }

  function handleDisplayDescriptionChange(description: string) {
    setDisplayDescription(description);
  }

  function handleContinue() {
    setFormKey((key) => key + 1);
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const documents: DocumentInput[] | undefined = importResult
    ? [
        ...importResult.documents,
        ...(includeSetupGuide
          ? [
              {
                title: importResult.setupGuide.title,
                category: importResult.setupGuide.category,
                filePath: importResult.setupGuide.filePath,
                content: setupGuideContent,
                source: importResult.setupGuide.source,
                generatedFromContent: importResult.setupGuide.content,
              } satisfies DocumentInput,
            ]
          : []),
      ]
    : undefined;

  return (
    <div className="w-full space-y-6">
      {!importResult ? (
        <>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Add Project</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Import from GitHub, or fill in the details manually below.
            </p>
          </div>
          <GitHubImportPanel onImported={handleImported} />
        </>
      ) : (
        importedAt && (
          <GitHubImportPreview
            result={importResult}
            importedAt={importedAt}
            displayName={displayName}
            displayDescription={displayDescription}
            onDisplayNameChange={handleDisplayNameChange}
            onDisplayDescriptionChange={handleDisplayDescriptionChange}
            includeSetupGuide={includeSetupGuide}
            onIncludeSetupGuideChange={setIncludeSetupGuide}
            onContinue={handleContinue}
          />
        )
      )}

      <div ref={formSectionRef} id="project-form" className="scroll-mt-4">
        {importResult && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Project details</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Review and save the project. Setup guide content is included when checked above.
            </p>
          </div>
        )}
        <ProjectForm
          key={formKey}
          initial={
            importResult
              ? toInitialValues(importResult, displayName, displayDescription)
              : prefilledGithubUrl || prefilledName
                ? { ...(prefilledGithubUrl ? { githubUrl: prefilledGithubUrl } : {}), ...(prefilledName ? { name: prefilledName } : {}) }
                : undefined
          }
          documents={documents}
          readmeContent={importResult?.readme.content}
          cancelHref="/projects"
        />
      </div>
    </div>
  );
}
