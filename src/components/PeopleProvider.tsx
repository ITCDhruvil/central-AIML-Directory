"use client";

import { createContext, useContext } from "react";
import { Avatar } from "@/components/Avatar";
import { useAuthUser } from "@/components/AuthProvider";
import { EMPTY_PEOPLE, findPicture, type PeopleDirectory } from "@/types/people";

const PeopleContext = createContext<PeopleDirectory>(EMPTY_PEOPLE);

export function PeopleProvider({ directory, children }: { directory: PeopleDirectory; children: React.ReactNode }) {
  return <PeopleContext.Provider value={directory}>{children}</PeopleContext.Provider>;
}

export function usePeople(): PeopleDirectory {
  return useContext(PeopleContext);
}

/**
 * A person's picture wherever they appear in the app, or their initials when they have none. Give the user id when you
 * have it; a name alone works too (a project's free-text owner), matched against everyone's name and linked owner names.
 * Every place uses this, so a person's picture is always the same one.
 */
export function PersonAvatar({
  userId,
  name,
  size = 24,
  className,
}: {
  userId?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const directory = usePeople();
  const me = useAuthUser();
  const found = findPicture(directory, { userId, name });
  // Your own picture comes from your session, which is never behind the directory's short cache.
  const version = found.id && me && found.id === me.id ? me.avatarVersion : found.version;

  return <Avatar user={{ id: found.id ?? "", name, avatarVersion: version }} size={size} className={className} />;
}
