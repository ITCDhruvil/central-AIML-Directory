/** Everyone who has set a profile picture, so any screen can show it next to that person's name. */
export interface PeopleDirectory {
  /** User id -> when their picture was last set (ms), which versions the picture's URL. Only people with a picture. */
  versions: Record<string, number>;
  /**
   * Normalised name -> user id, for places that only know a name (a project's free-text owner). Covers each person's own
   * name and the owner names an admin linked to them. A name two people share is left out rather than guessed.
   */
  idByName: Record<string, string>;
}

export const EMPTY_PEOPLE: PeopleDirectory = { versions: {}, idByName: {} };

/** Names are matched ignoring case and extra spaces: "  Dhruvil   Patel " and "dhruvil patel" are the same person. */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Resolves who a person is and which picture version to show, from an id or (failing that) a name. */
export function findPicture(
  directory: PeopleDirectory,
  who: { userId?: string | null; name: string },
): { id: string | null; version: number | null } {
  const id = who.userId || directory.idByName[nameKey(who.name)] || null;
  return { id, version: id ? (directory.versions[id] ?? null) : null };
}
