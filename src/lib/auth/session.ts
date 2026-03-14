import type { Role } from "./rbac";

export interface SessionUser {
  id: string;
  username: string;
  displayName: string | null;
  role: Role;
  isOwner: boolean;
  is2faEnabled: boolean;
}

export interface AppSession {
  user: SessionUser;
  expires: string;
}

export function makeSessionUser(user: {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  is2faEnabled: boolean;
}): SessionUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role as Role,
    isOwner: user.role === "owner",
    is2faEnabled: user.is2faEnabled,
  };
}
