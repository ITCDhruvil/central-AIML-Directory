"use client";

import { createContext, useContext } from "react";
import { DEFAULT_BRANDING, type Branding } from "@/lib/branding";

const BrandingContext = createContext<Branding>(DEFAULT_BRANDING);

/** Makes the admin-set workspace name available to client components (sidebar, top bar, sign-in page). */
export function BrandingProvider({ branding, children }: { branding: Branding; children: React.ReactNode }) {
  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding(): Branding {
  return useContext(BrandingContext);
}

/** The workspace name as plain text, for places that are otherwise server-rendered. */
export function BrandName() {
  return <>{useBranding().appName}</>;
}

/** The tagline as plain text; renders nothing when it is empty. */
export function BrandTagline() {
  return <>{useBranding().tagline}</>;
}
