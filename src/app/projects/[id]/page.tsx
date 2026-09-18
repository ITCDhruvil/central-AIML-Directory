import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  AlignLeft,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  FileText,
  IdCard,
  Link2,
  Network,
  Plus,
  Shield,
} from "lucide-react";
import { ActivityList } from "@/components/ActivityList";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { InlineEditableTitle } from "@/components/InlineEditableTitle";
import { InlineEditableDescription } from "@/components/InlineEditableDescription";
import { getProjectById } from "@/lib/projects";
import { listDocumentation } from "@/lib/documents";
import { listRecentProjectActivities } from "@/lib/projectActivity";
import { getNeedsAttentionIssues, type AttentionIssue } from "@/lib/needsAttention";
import { deploymentLabel, hasInternalDeployment, INTERNAL_ACCESS_HINT, isInternalDeploymentUrl } from "@/lib/deploymentLabel";
import { formatDate } from "@/lib/formatDate";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { ProjectTypeBadge } from "@/components/ProjectTypeBadge";
import { InternalDeployBadge } from "@/components/InternalDeployBadge";
import { ProjectTypeIcon } from "@/components/ProjectTypeIcon";
import { ProjectActions } from "@/components/ProjectActions";
import { ProjectCardMenu } from "@/components/ProjectCardMenu";
import { ProjectDetailTabs } from "@/components/ProjectDetailTabs";
import { SuggestImprovementsPanel } from "@/components/SuggestImprovementsPanel";
import { SyncGitHubPanel } from "@/components/SyncGitHubPanel";
import { ProjectAssistant } from "@/components/ProjectAssistant";
import { ProjectDetailsEditor } from "@/components/ProjectDetailsEditor";
import { TechStackSummaryEditor } from "@/components/TechStackSummaryEditor";
import { Button, type IconType } from "@/components/ui/Button";
import { EmptyState } from "@/components/EmptyState";
import { documentSourceLabel } from "@/lib/documentOwnership";
import type { Documentation } from "@/types/documentation";
import type { ProjectActivity } from "@/types/project";

function SectionCard({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: IconType;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <Icon size={16} className="text-zinc-400" />
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function DocumentLink({ projectId, doc }: { projectId: string; doc: Documentation }) {
  return (
    <Button
      href={`/projects/${projectId}/documents/${doc.id}`}
      variant="ghost"
      size="sm"
      className="w-full !justify-between font-normal"
    >
      <span className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
        <FileText size={14} className="shrink-0 text-zinc-400" />
        {doc.title}
      </span>
      <span className="text-xs text-zinc-400">
        {doc.category} · {documentSourceLabel(doc.source)}
      </span>
    </Button>
  );
}

function RecentActivitySection({ activities }: { activities: ProjectActivity[] }) {
  return (
    <SectionCard icon={Activity} title="Recent Activity">
      <ActivityList activities={activities} />
    </SectionCard>
  );
}

function NeedsAttentionSection({ issues }: { issues: AttentionIssue[] }) {
  return (
    <SectionCard icon={AlertTriangle} title="Needs Attention">
      {issues.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <CheckCircle2 size={14} className="shrink-0 text-green-600 dark:text-green-400" />
          Everything looks good
        </div>
      ) : (
        <ul className="space-y-2.5">
          {issues.map((issue) => (
            <li key={issue.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="flex items-start gap-2 text-zinc-800 dark:text-zinc-200">
                <AlertTriangle
                  size={14}
                  className={
                    issue.severity === "error"
                      ? "mt-0.5 shrink-0 text-red-500"
                      : "mt-0.5 shrink-0 text-amber-500"
                  }
                />
                {issue.message}
              </span>
              {issue.href && issue.actionLabel && (
                <Link
                  href={issue.href}
                  className="shrink-0 text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
                >
                  {issue.actionLabel}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProjectById(id);

  if (!project) {
    notFound();
  }

  const [documents, activities] = await Promise.all([
    listDocumentation(project.id),
    listRecentProjectActivities(project.id, 200),
  ]);
  const attentionIssues = getNeedsAttentionIssues(project);
  const repoDocuments = documents.filter((doc) => doc.source === "github");
  const generatedDocuments = documents.filter((doc) => doc.source === "generated");
  const manualDocuments = documents.filter((doc) => doc.source === "manual");
  const isGithubConnected = Boolean(project.githubUrl && project.githubOwner && project.githubRepo);

  const readmeDoc = documents.find((d) => d.category === "README");
  const setupGuideDoc = documents.find((d) => d.source === "generated");
  const architectureDoc = documents.find((d) => d.category === "ARCHITECTURE");

  const overviewPanel = (
    <>
      <SectionCard icon={AlignLeft} title="Description">
        <InlineEditableDescription project={project} />
      </SectionCard>

      <SectionCard
        icon={GithubIcon}
        title="Overview"
        action={<ProjectCardMenu id={project.id} name={project.name} githubUrl={project.githubUrl} />}
      >
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {isGithubConnected ? (
            <div className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <GithubIcon size={14} className="shrink-0 text-zinc-400" />
              <span className="w-36 shrink-0 text-zinc-500 dark:text-zinc-400">GitHub Repository</span>
              <Button href={project.githubUrl!} external icon={ExternalLink} variant="secondary" size="sm">
                {project.githubOwner}/{project.githubRepo}
              </Button>
              {project.defaultBranch && (
                <span className="text-xs text-zinc-400">default branch: {project.defaultBranch}</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-2.5 text-sm text-zinc-400">
              <GithubIcon size={14} className="shrink-0" />
              GitHub not configured — use{" "}
              <Link href={`/projects/${project.id}/edit`} className="underline hover:text-zinc-600 dark:hover:text-zinc-300">
                Edit
              </Link>{" "}
              to connect a repository.
            </div>
          )}

          {project.deploymentUrls.map((url) => {
            const label = deploymentLabel(url);
            let hostname = url;
            try {
              hostname = new URL(url).hostname;
            } catch {
              // not a parseable URL — fall back to showing it as-is
            }
            // deploymentLabel() falls back to the hostname itself when it
            // can't classify the URL (Local/Staging/UAT/Production/Dev) —
            // skip the descriptor in that case so it doesn't just repeat
            // the hostname shown in the button right next to it.
            const showLabel = label !== hostname && label !== "Internal";
            const internal = isInternalDeploymentUrl(url);

            return (
              <div key={url} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                <Link2 size={14} className="shrink-0 text-zinc-400" />
                {showLabel && <span className="w-36 shrink-0 text-zinc-500 dark:text-zinc-400">{label}</span>}
                <Button href={url} external icon={ExternalLink} variant="secondary" size="sm">
                  {hostname}
                </Button>
                <Button href={url} external variant="ghost" size="sm">
                  Visit
                </Button>
                {internal && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <InternalDeployBadge />
                    {INTERNAL_ACCESS_HINT}
                  </span>
                )}
              </div>
            );
          })}

          {project.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <span className="w-36 shrink-0 text-zinc-500 dark:text-zinc-400">Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {isGithubConnected && <SyncGitHubPanel projectId={project.id} lastSyncedAt={project.lastSyncedAt} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RecentActivitySection activities={activities} />
        <NeedsAttentionSection issues={attentionIssues} />
      </div>

      <SuggestImprovementsPanel projectId={project.id} />
    </>
  );

  const documentationPanel = (
    <SectionCard
      icon={FileText}
      title={`Documentation — ${documents.length} document${documents.length === 1 ? "" : "s"}`}
      action={
        <Button href={`/projects/${project.id}/documents/new`} variant="ghost" size="sm" icon={Plus}>
          Add Documentation
        </Button>
      }
    >
      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documentation yet"
          description="Import from GitHub, or add one manually."
          actionHref={`/projects/${project.id}/documents/new`}
          actionLabel="Add Documentation"
        />
      ) : (
        <div className="space-y-4">
          {repoDocuments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Repository</p>
              <ul className="mt-1 space-y-0.5">
                {repoDocuments.map((doc) => (
                  <li key={doc.id}>
                    <DocumentLink projectId={project.id} doc={doc} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {generatedDocuments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Generated</p>
              <ul className="mt-1 space-y-0.5">
                {generatedDocuments.map((doc) => (
                  <li key={doc.id}>
                    <DocumentLink projectId={project.id} doc={doc} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {manualDocuments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Manual</p>
              <ul className="mt-1 space-y-0.5">
                {manualDocuments.map((doc) => (
                  <li key={doc.id}>
                    <DocumentLink projectId={project.id} doc={doc} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );

  const askAiPanel = <ProjectAssistant projectId={project.id} />;

  const linksPanel =
    project.githubUrl || project.deploymentUrls.length > 0 || readmeDoc || setupGuideDoc || architectureDoc ? (
      <SectionCard icon={Link2} title="Quick Links">
        <div className="flex flex-wrap gap-2">
          {project.githubUrl && (
            <Button href={project.githubUrl} external icon={GithubIcon} variant="secondary" size="sm">
              GitHub
            </Button>
          )}
          {project.deploymentUrls.length > 0 && (
            <Button href={project.deploymentUrls[0]} external icon={ExternalLink} variant="secondary" size="sm">
              Deployment
            </Button>
          )}
          {readmeDoc && (
            <Button href={`/projects/${project.id}/documents/${readmeDoc.id}`} icon={FileText} variant="secondary" size="sm">
              README
            </Button>
          )}
          {setupGuideDoc && (
            <Button href={`/projects/${project.id}/documents/${setupGuideDoc.id}`} icon={FileText} variant="secondary" size="sm">
              Setup Guide
            </Button>
          )}
          {architectureDoc && (
            <Button href={`/projects/${project.id}/documents/${architectureDoc.id}`} icon={FileText} variant="secondary" size="sm">
              Architecture
            </Button>
          )}
        </div>
      </SectionCard>
    ) : (
      <EmptyState
        icon={Link2}
        title="No links yet"
        description="Connect a GitHub repository or add a deployment URL to see quick links here."
        actionHref={`/projects/${project.id}/edit`}
        actionLabel="Edit Project"
      />
    );

  return (
    <div className="w-full space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/projects" className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100">
          <ArrowLeft size={14} />
          Projects
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <ProjectTypeIcon technologies={project.technologies} size={48} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <InlineEditableTitle project={project} />
              <ProjectTypeBadge type={project.type} />
              <ProjectStatusBadge status={project.status} />
              {hasInternalDeployment(project.deploymentUrls) && <InternalDeployBadge />}
            </div>
          </div>
        </div>
        <ProjectActions id={project.id} name={project.name} deploymentUrl={project.deploymentUrls[0] ?? null} />
      </div>

      {hasInternalDeployment(project.deploymentUrls) && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Shield size={16} className="mt-0.5 shrink-0" />
          <p>This project is deployed on an internal server. You need VPN or remote access to open it.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column — tabs switch which panel is mounted */}
        <div className="lg:col-span-2">
          <ProjectDetailTabs overview={overviewPanel} documentation={documentationPanel} askAi={askAiPanel} links={linksPanel} />
        </div>

        {/* Sidebar column — same on every tab, sticks in place and scrolls on its own once its content outgrows the viewport */}
        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <SectionCard icon={IdCard} title="Project Details">
            <ProjectDetailsEditor project={project} />
          </SectionCard>

          <SectionCard icon={BarChart3} title="Tech Stack Summary">
            <TechStackSummaryEditor project={project} />
          </SectionCard>

          <SectionCard icon={Network} title="Related Projects">
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <Network size={28} className="text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No related projects yet</p>
              <p className="text-xs text-zinc-400">You can link related projects to keep everything organized.</p>
              <Button variant="secondary" size="sm" icon={Plus} disabled title="Not available yet" className="mt-1">
                Link Project
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-zinc-400">
        Created {formatDate(project.createdAt)} · Updated {formatDate(project.updatedAt)}
        {isGithubConnected && (
          <>
            {" · "}
            {project.lastSyncedAt ? `Synced ${formatRelativeTime(project.lastSyncedAt)}` : "Never synced"}
          </>
        )}
      </p>
    </div>
  );
}
