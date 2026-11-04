import { EnvironmentError } from "@/lib/environments/validate";

// The ping fetches a URL that a project editor typed in, from our server. Refuse the targets that would let it reach
// this machine or the cloud metadata service. Other private hosts are allowed: company environments often live there.
const BLOCKED_HOST = /^(localhost|0\.0\.0\.0|metadata\.google\.internal|\[?::1?\]?|127\.\d+\.\d+\.\d+|169\.254\.\d+\.\d+|\[?fe80:.*)$/i;

export function isBlockedHealthHost(hostname: string): boolean {
  return BLOCKED_HOST.test(hostname) || hostname.endsWith(".localhost");
}

/** LIVE when the URL answers with a non-error status within 5 seconds, otherwise DOWN. */
export async function pingUrl(url: string): Promise<"LIVE" | "DOWN"> {
  const parsed = new URL(url);
  if (isBlockedHealthHost(parsed.hostname)) {
    throw new EnvironmentError("That health-check address can't be pinged from the server.");
  }
  try {
    // redirect "manual" so a redirect can't carry the request to a blocked address.
    const res = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(5000), cache: "no-store" });
    return res.status < 400 ? "LIVE" : "DOWN";
  } catch {
    return "DOWN";
  }
}
