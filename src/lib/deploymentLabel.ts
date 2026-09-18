const INTERNAL_HOST_SUFFIXES = [
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".corp",
  ".localdomain",
  ".home",
  ".private",
] as const;

const INTERNAL_HOST_LABELS = new Set(["internal", "intranet", "corp", "lan"]);

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0:0:0:0:0:0:0:1";
}

function isPrivateIPv4(host: string): boolean {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((n) => n > 255)) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function isPrivateIPv6(host: string): boolean {
  if (!host.includes(":")) return false;
  // Unique local (fc00::/7) and link-local (fe80::/10).
  if (host.startsWith("fc") || host.startsWith("fd")) return true;
  if (host.startsWith("fe80:")) return true;
  return false;
}

/**
 * True when a deployment URL points at a private/internal host.
 * Localhost is excluded — that's just local, not a VPN-gated internal server.
 */
export function isInternalDeploymentUrl(url: string): boolean {
  const hostname = hostnameOf(url).trim().toLowerCase().replace(/\.$/, "");
  if (!hostname) return false;

  const host = hostname.replace(/^\[|\]$/g, "");
  if (isLoopbackHost(host)) return false;
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) return true;
  if (!host.includes(".")) return true;
  if (INTERNAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (host.split(".").some((label) => INTERNAL_HOST_LABELS.has(label))) return true;
  return false;
}

export function hasInternalDeployment(urls: string[]): boolean {
  return urls.some(isInternalDeploymentUrl);
}

/** The URL Visit should open from a card: a public deploy if one exists, otherwise the first URL. */
export function primaryDeploymentUrl(urls: string[]): string | null {
  const usable = urls.map((url) => url.trim()).filter(Boolean);
  if (usable.length === 0) return null;
  return usable.find((url) => !isInternalDeploymentUrl(url)) ?? usable[0];
}

/** Copy shown next to internal deploys — VPN or remote access is required to open them. */
export const INTERNAL_ACCESS_HINT = "VPN or remote access required";

/** Simple deterministic label derived from a deployment URL — no AI classification. */
export function deploymentLabel(url: string): string {
  const hostname = hostnameOf(url);
  const haystack = `${hostname} ${url}`.toLowerCase();

  if (haystack.includes("localhost") || haystack.includes("127.0.0.1")) return "Local";
  if (haystack.includes("staging") || haystack.includes("stage")) return "Staging";
  if (haystack.includes("uat")) return "UAT";
  if (haystack.includes("prod")) return "Production";
  if (haystack.includes("dev.") || haystack.includes("-dev")) return "Dev";
  if (isInternalDeploymentUrl(url)) return "Internal";
  return hostname;
}
