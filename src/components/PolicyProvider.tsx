"use client";

import { createContext, useContext } from "react";
import { DEFAULT_SECURITY_POLICY, type SecurityPolicy } from "@/lib/securityPolicy";

const PolicyContext = createContext<SecurityPolicy>(DEFAULT_SECURITY_POLICY);

/**
 * Makes the admin-set security policy available to every client component, including the sign-in page. It is read once
 * per page load on the server, so a change applies on the next load.
 */
export function PolicyProvider({ policy, children }: { policy: SecurityPolicy; children: React.ReactNode }) {
  return <PolicyContext.Provider value={policy}>{children}</PolicyContext.Provider>;
}

export function useSecurityPolicy(): SecurityPolicy {
  return useContext(PolicyContext);
}
