import { Button } from "@/components/ui/Button";
import { GithubIcon } from "@/components/icons/GithubIcon";

/** Where GitHub sends the person back to after they approve (or cancel) the connection. */
export function githubConnectHref(returnTo: string): string {
  return `/api/github/connect?next=${encodeURIComponent(returnTo)}`;
}

/** Shown when an import needs the person's own GitHub account first. A full page load, since GitHub takes over. */
export function GitHubConnectPrompt({ returnTo, message }: { returnTo: string; message?: string }) {
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200 sm:flex-row sm:items-center sm:justify-between">
      <p>{message ?? "Connect your GitHub account first so we can read repositories you have access to."}</p>
      <Button variant="primary" size="sm" icon={GithubIcon} href={githubConnectHref(returnTo)} external>
        Connect GitHub
      </Button>
    </div>
  );
}
