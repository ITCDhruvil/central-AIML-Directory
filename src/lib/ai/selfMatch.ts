/**
 * True when an owner filter is really the signed-in person: "my ideas" often reaches the tools as their own name, first
 * name or email. Matching a first name alone is deliberate ("Devika" for "Devika S Vinod"), but only as a whole first word.
 */
export function isSelf(owner: string, user: { name: string; email: string }): boolean {
  const o = owner.trim().toLowerCase();
  const name = user.name.trim().toLowerCase();
  if (!o) return false;
  return o === name || name.startsWith(`${o} `) || o === user.email.trim().toLowerCase();
}
