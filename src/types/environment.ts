import type { EnvironmentStatus } from "@/lib/environments/validate";

export type EnvironmentLinkView = {
  id: string;
  label: string;
  url: string;
  group: string | null;
  updatedByName: string | null;
  updatedAt: string;
};

/** A test account as listed. The password itself is never part of this: only whether one is stored. */
export type EnvironmentCredentialView = {
  id: string;
  purpose: string;
  username: string;
  notes: string | null;
  hasPassword: boolean;
  passwordUpdatedByName: string | null;
  passwordUpdatedAt: string | null;
  updatedByName: string | null;
  updatedAt: string;
};

export type EnvironmentView = {
  id: string;
  name: string;
  isProduction: boolean;
  status: EnvironmentStatus;
  appUrl: string | null;
  apiUrl: string | null;
  healthUrl: string | null;
  hosting: string | null;
  databaseSet: string | null;
  version: string | null;
  lastDeployedAt: string | null;
  lastCheckedAt: string | null;
  notes: string | null;
  updatedByName: string | null;
  updatedAt: string;
  links: EnvironmentLinkView[];
  credentials: EnvironmentCredentialView[];
};
