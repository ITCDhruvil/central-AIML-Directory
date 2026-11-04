import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptPassword, encryptPassword } from "@/lib/environments/credentialCrypto";
import { pingUrl } from "@/lib/environments/healthCheck";
import {
  DEFAULT_ENVIRONMENTS,
  EnvironmentError,
  assertCanHoldCredentials,
  nameKey,
  type CredentialInput,
  type EnvironmentInput,
  type EnvironmentStatus,
  type LinkInput,
} from "@/lib/environments/validate";
import type { EnvironmentCredentialView, EnvironmentLinkView, EnvironmentView } from "@/types/environment";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

const INCLUDE = {
  links: { orderBy: [{ position: "asc" as const }, { updatedAt: "asc" as const }] },
  credentials: { orderBy: { createdAt: "asc" as const } },
};

type EnvRow = NonNullable<Awaited<ReturnType<typeof findRow>>>;

function findRow(projectId: string, envId: string) {
  return prisma.projectEnvironment.findFirst({ where: { id: envId, projectId }, include: INCLUDE });
}

function toLink(l: EnvRow["links"][number]): EnvironmentLinkView {
  return { id: l.id, label: l.label, url: l.url, group: l.group, updatedByName: l.updatedByName, updatedAt: l.updatedAt.toISOString() };
}

function toCredential(c: EnvRow["credentials"][number]): EnvironmentCredentialView {
  // passwordEnc is deliberately not copied: list responses never carry the password, encrypted or not.
  return {
    id: c.id,
    purpose: c.purpose,
    username: c.username,
    notes: c.notes,
    hasPassword: Boolean(c.passwordEnc),
    passwordUpdatedByName: c.passwordUpdatedByName,
    passwordUpdatedAt: iso(c.passwordUpdatedAt),
    updatedByName: c.updatedByName,
    updatedAt: c.updatedAt.toISOString(),
  };
}

function toView(e: EnvRow): EnvironmentView {
  return {
    id: e.id,
    name: e.name,
    isProduction: e.isProduction,
    status: e.status as EnvironmentStatus,
    appUrl: e.appUrl,
    apiUrl: e.apiUrl,
    healthUrl: e.healthUrl,
    hosting: e.hosting,
    databaseSet: e.databaseSet,
    version: e.version,
    lastDeployedAt: iso(e.lastDeployedAt),
    lastCheckedAt: iso(e.lastCheckedAt),
    notes: e.notes,
    updatedByName: e.updatedByName,
    updatedAt: e.updatedAt.toISOString(),
    links: e.links.map(toLink),
    // A production environment never lists accounts, even if some were stored before it was flagged.
    credentials: e.isProduction ? [] : e.credentials.map(toCredential),
  };
}

async function requireRow(projectId: string, envId: string): Promise<EnvRow> {
  const row = await findRow(projectId, envId);
  if (!row) throw new EnvironmentError("Environment not found", 404);
  return row;
}

async function assertNameFree(projectId: string, name: string, exceptId?: string): Promise<void> {
  const all = await prisma.projectEnvironment.findMany({ where: { projectId }, select: { id: true, name: true } });
  if (all.some((e) => e.id !== exceptId && nameKey(e.name) === nameKey(name))) {
    throw new EnvironmentError(`An environment named "${name}" already exists in this project`, 409);
  }
}

export async function listEnvironments(projectId: string): Promise<EnvironmentView[]> {
  const rows = await prisma.projectEnvironment.findMany({
    where: { projectId },
    include: INCLUDE,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toView);
}

export async function getEnvironment(projectId: string, envId: string): Promise<EnvironmentView> {
  return toView(await requireRow(projectId, envId));
}

async function nextPosition(projectId: string): Promise<number> {
  const last = await prisma.projectEnvironment.aggregate({ where: { projectId }, _max: { position: true } });
  return (last._max.position ?? -1) + 1;
}

export async function createEnvironment(projectId: string, input: EnvironmentInput, actorName: string): Promise<EnvironmentView> {
  const name = input.name as string;
  await assertNameFree(projectId, name);
  const created = await prisma.projectEnvironment.create({
    data: { ...input, name, projectId, position: await nextPosition(projectId), updatedByName: actorName },
    include: INCLUDE,
  });
  return toView(created);
}

/** Adds DEV, QA, UAT and PROD (PROD flagged Production) for whichever of those names the project doesn't have yet. */
export async function createDefaultEnvironments(projectId: string, actorName: string): Promise<EnvironmentView[]> {
  const existing = await prisma.projectEnvironment.findMany({ where: { projectId }, select: { name: true } });
  const have = new Set(existing.map((e) => nameKey(e.name)));
  let position = await nextPosition(projectId);
  for (const def of DEFAULT_ENVIRONMENTS) {
    if (have.has(nameKey(def.name))) continue;
    await prisma.projectEnvironment.create({
      data: { projectId, name: def.name, isProduction: def.isProduction, status: "NOT_DEPLOYED", position: position++, updatedByName: actorName },
    });
  }
  return listEnvironments(projectId);
}

export async function updateEnvironment(
  projectId: string,
  envId: string,
  input: EnvironmentInput,
  actorName: string,
): Promise<EnvironmentView> {
  const current = await requireRow(projectId, envId);
  if (input.name !== undefined) await assertNameFree(projectId, input.name, envId);
  if (input.isProduction === true && !current.isProduction && current.credentials.length > 0) {
    throw new EnvironmentError("Delete this environment's test accounts before marking it Production.", 409);
  }
  const updated = await prisma.projectEnvironment.update({
    where: { id: envId },
    data: { ...input, updatedByName: actorName },
    include: INCLUDE,
  });
  return toView(updated);
}

export async function deleteEnvironment(projectId: string, envId: string): Promise<{ name: string }> {
  const row = await requireRow(projectId, envId);
  await prisma.projectEnvironment.delete({ where: { id: envId } });
  return { name: row.name };
}

export async function reorderEnvironments(projectId: string, ids: string[]): Promise<EnvironmentView[]> {
  const rows = await prisma.projectEnvironment.findMany({ where: { projectId }, select: { id: true } });
  const known = new Set(rows.map((r) => r.id));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw new EnvironmentError("The new order must list every environment of the project exactly once");
  }
  await prisma.$transaction(ids.map((id, position) => prisma.projectEnvironment.update({ where: { id }, data: { position } })));
  return listEnvironments(projectId);
}

/** Copies an environment's settings and links under a new name. Test accounts and passwords are never copied. */
export async function duplicateEnvironment(projectId: string, envId: string, newName: string, actorName: string): Promise<EnvironmentView> {
  const src = await requireRow(projectId, envId);
  await assertNameFree(projectId, newName);
  const created = await prisma.projectEnvironment.create({
    data: {
      projectId,
      name: newName,
      isProduction: src.isProduction,
      status: "PLANNED",
      appUrl: src.appUrl,
      apiUrl: src.apiUrl,
      healthUrl: src.healthUrl,
      hosting: src.hosting,
      databaseSet: src.databaseSet,
      notes: src.notes,
      position: await nextPosition(projectId),
      updatedByName: actorName,
      links: {
        create: src.links.map((l, position) => ({ label: l.label, url: l.url, group: l.group, position, updatedByName: actorName })),
      },
    },
    include: INCLUDE,
  });
  return toView(created);
}

/** Calls the health-check URL and records LIVE/DOWN. */
export async function pingEnvironment(projectId: string, envId: string, actorName: string): Promise<EnvironmentView> {
  const row = await requireRow(projectId, envId);
  if (!row.healthUrl) throw new EnvironmentError("Add a health-check URL first");
  const status = await pingUrl(row.healthUrl);
  const updated = await prisma.projectEnvironment.update({
    where: { id: envId },
    data: { status, lastCheckedAt: new Date(), updatedByName: actorName },
    include: INCLUDE,
  });
  return toView(updated);
}

// --- links -----------------------------------------------------------------------------------------------------

export async function createLink(projectId: string, envId: string, input: LinkInput, actorName: string): Promise<EnvironmentView> {
  await requireRow(projectId, envId);
  const last = await prisma.environmentLink.aggregate({ where: { environmentId: envId }, _max: { position: true } });
  await prisma.environmentLink.create({
    data: {
      environmentId: envId,
      label: input.label as string,
      url: input.url as string,
      group: input.group ?? null,
      position: (last._max.position ?? -1) + 1,
      updatedByName: actorName,
    },
  });
  return getEnvironment(projectId, envId);
}

async function requireLink(projectId: string, envId: string, linkId: string) {
  const link = await prisma.environmentLink.findFirst({ where: { id: linkId, environmentId: envId, environment: { projectId } } });
  if (!link) throw new EnvironmentError("Link not found", 404);
  return link;
}

export async function updateLink(projectId: string, envId: string, linkId: string, input: LinkInput, actorName: string): Promise<EnvironmentView> {
  await requireLink(projectId, envId, linkId);
  await prisma.environmentLink.update({ where: { id: linkId }, data: { ...input, updatedByName: actorName } });
  return getEnvironment(projectId, envId);
}

export async function deleteLink(projectId: string, envId: string, linkId: string): Promise<EnvironmentView> {
  await requireLink(projectId, envId, linkId);
  await prisma.environmentLink.delete({ where: { id: linkId } });
  return getEnvironment(projectId, envId);
}

// --- test accounts -----------------------------------------------------------------------------------------------

async function requireCredential(projectId: string, envId: string, credId: string) {
  const cred = await prisma.environmentCredential.findFirst({
    where: { id: credId, environmentId: envId, environment: { projectId } },
    include: { environment: { select: { name: true, isProduction: true } } },
  });
  if (!cred) throw new EnvironmentError("Test account not found", 404);
  return cred;
}

export async function createCredential(projectId: string, envId: string, input: CredentialInput, actorName: string): Promise<EnvironmentView> {
  const env = await requireRow(projectId, envId);
  assertCanHoldCredentials(env);
  const hasPassword = typeof input.password === "string";
  await prisma.environmentCredential.create({
    data: {
      environmentId: envId,
      purpose: input.purpose as string,
      username: input.username as string,
      notes: input.notes ?? null,
      passwordEnc: hasPassword ? encryptPassword(input.password as string) : null,
      passwordUpdatedAt: hasPassword ? new Date() : null,
      passwordUpdatedByName: hasPassword ? actorName : null,
      updatedByName: actorName,
    },
  });
  return getEnvironment(projectId, envId);
}

export async function updateCredential(
  projectId: string,
  envId: string,
  credId: string,
  input: CredentialInput,
  actorName: string,
): Promise<EnvironmentView> {
  const cred = await requireCredential(projectId, envId, credId);
  assertCanHoldCredentials(cred.environment);
  const { password, ...rest } = input;
  await prisma.environmentCredential.update({
    where: { id: credId },
    data: {
      ...rest,
      updatedByName: actorName,
      // Absent password = leave the stored one alone; null clears it; a string replaces it.
      ...(password === undefined
        ? {}
        : password === null
          ? { passwordEnc: null, passwordUpdatedAt: new Date(), passwordUpdatedByName: actorName }
          : { passwordEnc: encryptPassword(password), passwordUpdatedAt: new Date(), passwordUpdatedByName: actorName }),
    },
  });
  return getEnvironment(projectId, envId);
}

export async function deleteCredential(projectId: string, envId: string, credId: string): Promise<{ environment: EnvironmentView; username: string }> {
  const cred = await requireCredential(projectId, envId, credId);
  await prisma.environmentCredential.delete({ where: { id: credId } });
  return { environment: await getEnvironment(projectId, envId), username: cred.username };
}

/** The only place a stored password is decrypted. Callers must have checked edit rights and must audit the call. */
export async function revealPassword(
  projectId: string,
  envId: string,
  credId: string,
): Promise<{ password: string; username: string; environmentName: string }> {
  const cred = await requireCredential(projectId, envId, credId);
  assertCanHoldCredentials(cred.environment);
  if (!cred.passwordEnc) throw new EnvironmentError("No password is stored for this account", 404);
  const password = decryptPassword(cred.passwordEnc);
  if (password === null) {
    throw new EnvironmentError("This password can no longer be read. Please enter it again.", 409);
  }
  return { password, username: cred.username, environmentName: cred.environment.name };
}

// --- export ------------------------------------------------------------------------------------------------------

/** Environments and links as plain data. Test accounts are left out on purpose. */
export async function exportEnvironments(projectId: string) {
  const envs = await listEnvironments(projectId);
  return envs.map((e) => ({
    name: e.name,
    isProduction: e.isProduction,
    status: e.status,
    appUrl: e.appUrl,
    apiUrl: e.apiUrl,
    healthUrl: e.healthUrl,
    hosting: e.hosting,
    databaseSet: e.databaseSet,
    version: e.version,
    lastDeployedAt: e.lastDeployedAt,
    notes: e.notes,
    links: e.links.map((l) => ({ label: l.label, url: l.url, group: l.group })),
  }));
}
