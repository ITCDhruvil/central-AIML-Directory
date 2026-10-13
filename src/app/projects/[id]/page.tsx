import { loadViewAccess, requirePagePermission } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { NO_ACCESS } from "@/lib/auth/scope";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  AlignLeft,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  FileText,
  IdCard,
  LayoutList,
  Link2,
  Network,
  Plus,
  Sparkles,
  Tag,
  Users,
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
import { DismissibleInternalHint } from "@/components/DismissibleInternalHint";
import { SuggestImprovementsPanel } from "@/components/SuggestImprovementsPanel";
import { SyncGitHubPanel } from "@/components/SyncGitHubPanel";
import { ProjectAssistant } from "@/components/ProjectAssistant";
import { ProjectDetailsEditor } from "@/components/ProjectDetailsEditor";
import { ProjectTeam } from "@/components/ProjectTeam";
import { canManageProjectTeam } from "@/lib/projectTeamAccess";
import { TechStackSummaryEditor } from "@/components/TechStackSummaryEditor";
import { Button, type IconType } from "@/components/ui/Button";
import { Breadcrumb1 } from "@/components/ui/breadcrumb-01";
import { EmptyState } from "@/components/EmptyState";
import { documentSourceLabel } from "@/lib/documentOwnership";
import type { Documentation } from "@/types/documentation";
import type { ProjectActivity } from "@/types/project";

const DETAIL_ROW = "grid grid-cols-1 gap-2 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center sm:gap-x-4";
const DETAIL_LABEL = "flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400";

function DetailRow({ icon: Icon, label, children }: { icon: IconType; label: string; children: React.ReactNode }) {
  return (
    <div className={DETAIL_ROW}>
      <div className={DETAIL_LABEL}>
        <Icon size={14} className="shrink-0 text-zinc-400" />
        {label}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">{children}</div>
    </div>
  );
}

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
  const { user, access } = await requirePagePermission("projects", "view");
  const { id } = await params;
  const project = await getProjectById(id, access);

  if (!project) {
    notFound();
  }

  const canEditProject = can(user.permissions, "projects", "edit");
  const canManageTeam = await canManageProjectTeam(user, project);
  const canCreateDocument = can(user.permissions, "documents", "create");
  const canUseAssistant = can(user.permissions, "ai_project_assistant", "use");
  const canViewDocuments = can(user.permissions, "documents", "view");
  const documentAccess = canViewDocuments ? (await loadViewAccess(user)).documents : NO_ACCESS;
  const [documents, activities] = await Promise.all([
    canViewDocuments ? listDocumentation(project.id, documentAccess) : Promise.resolve([]),
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
        icon={LayoutList}
        title="Overview"
        action={<ProjectCardMenu id={project.id} name={project.name} githubUrl={project.githubUrl} />}
      >
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {isGithubConnected ? (
            <DetailRow icon={GithubIcon} label="Repository">
              <Button href={project.githubUrl!} external icon={ExternalLink} variant="secondary" size="sm">
                {project.githubOwner}/{project.githubRepo}
              </Button>
              {project.defaultBranch && (
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {project.defaultBranch}
                </span>
              )}
            </DetailRow>
          ) : (
            <DetailRow icon={GithubIcon} label="Repository">
              <span className="text-sm text-zinc-400">
                Not connected —{" "}
                <Link href={`/projects/${project.id}/edit`} className="underline hover:text-zinc-600 dark:hover:text-zinc-300">
                  edit this project
                </Link>{" "}
                to add a repository.
              </span>
            </DetailRow>
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
            // can't classify the URL (Local/Staging/UAT/Production/Dev).
            const rowLabel = label !== hostname && label !== "Internal" ? label : "Deployment";
            const internal = isInternalDeploymentUrl(url);

            return (
              <DetailRow key={url} icon={Link2} label={rowLabel}>
                <Button href={url} external icon={ExternalLink} variant="secondary" size="sm">
                  {hostname}
                </Button>
                {internal && (
                  <span className="inline-flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <InternalDeployBadge />
                    {INTERNAL_ACCESS_HINT}
                  </span>
                )}
              </DetailRow>
            );
          })}

          {project.tags.length > 0 && (
            <DetailRow icon={Tag} label="Tags">
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
            </DetailRow>
          )}

          {isGithubConnected && canEditProject && (
            <SyncGitHubPanel projectId={project.id} lastSyncedAt={project.lastSyncedAt} embedded />
          )}
        </div>
      </SectionCard>

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
        canCreateDocument ? (
          <Button href={`/projects/${project.id}/documents/new`} variant="ghost" size="sm" icon={Plus}>
            Add Documentation
          </Button>
        ) : undefined
      }
    >
      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documentation yet"
          description={canCreateDocument ? "Import from GitHub, or add one manually." : "Nothing has been documented here yet."}
          actionHref={canCreateDocument ? `/projects/${project.id}/documents/new` : undefined}
          actionLabel={canCreateDocument ? "Add Documentation" : undefined}
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

  const askAiPanel = canUseAssistant ? (
    <ProjectAssistant projectId={project.id} />
  ) : (
    <EmptyState
      icon={Sparkles}
      title="AI assistant unavailable"
      description="The project assistant isn't enabled for your account."
    />
  );

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
        actionHref={canEditProject ? `/projects/${project.id}/edit` : undefined}
        actionLabel={canEditProject ? "Edit Project" : undefined}
      />
    );

  const detailsColumn = (
    <>
      <SectionCard icon={Users} title="Team">
        <ProjectTeam
          projectId={project.id}
          team={project.team ?? []}
          legacyOwner={project.owner}
          canManage={canManageTeam}
        />
      </SectionCard>

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
    </>
  );

  return (
    <div className="page-lock flex h-full min-h-0 w-full flex-1 flex-col gap-5">
      <div className="shrink-0 space-y-4">
        <Breadcrumb1
          segments={[
            { label: "Projects", href: "/projects" },
            { label: project.name, current: true },
          ]}
        />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <ProjectTypeIcon name={project.name} description={project.description} technologies={project.technologies} size={48} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <InlineEditableTitle project={project} className="text-3xl leading-none sm:text-4xl" />
                <ProjectTypeBadge type={project.type} />
                <ProjectStatusBadge status={project.status} />
                {hasInternalDeployment(project.deploymentUrls) && <InternalDeployBadge />}
              </div>
            </div>
          </div>
          {hasInternalDeployment(project.deploymentUrls) && (
            <div className="ml-auto shrink-0">
              <DismissibleInternalHint projectId={project.id} />
            </div>
          )}
        </div>
      </div>

      <ProjectDetailTabs
        overview={overviewPanel}
        documentation={documentationPanel}
        askAi={askAiPanel}
        links={linksPanel}
        sidebar={detailsColumn}
        actions={
          <ProjectActions id={project.id} name={project.name} deploymentUrl={project.deploymentUrls[0] ?? null} />
        }
        footer={
          <p className="text-xs text-zinc-400">
            Created {formatDate(project.createdAt)} · Updated {formatDate(project.updatedAt)}
            {isGithubConnected && (
              <>
                {" · "}
                {project.lastSyncedAt ? `Synced ${formatRelativeTime(project.lastSyncedAt)}` : "Never synced"}
              </>
            )}
          </p>
        }
      />
    </div>
  );
}
