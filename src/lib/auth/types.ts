import type { PermissionSet, Role } from "@/lib/auth/permissions";

/** Serializable current-user shape, safe to pass to client components. Never contains the hash. */
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
  /** When the profile picture was last set (ms since epoch), or null for none. It versions the picture's URL. */
  avatarVersion: number | null;
  permissions: PermissionSet;
};
