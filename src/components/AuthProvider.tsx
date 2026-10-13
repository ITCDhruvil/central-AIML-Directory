"use client";

import { createContext, useContext } from "react";
import { can, scopeFor, type Scope } from "@/lib/auth/permissions";
import type { AuthUser } from "@/lib/auth/types";

const AuthContext = createContext<AuthUser | null>(null);

export function AuthProvider({ user, children }: { user: AuthUser | null; children: React.ReactNode }) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuthUser(): AuthUser | null {
  return useContext(AuthContext);
}

/**
 * UI convenience only — hides controls the user can't use. The API routes and server pages
 * enforce the same permissions, so a hidden button is never the only protection.
 */
export function useCan(resource: string, action: string): boolean {
  const user = useContext(AuthContext);
  return user ? can(user.permissions, resource, action) : false;
}

export function useScope(resource: string, action: string): Scope {
  const user = useContext(AuthContext);
  return user ? scopeFor(user.permissions, resource, action) : "NONE";
}
