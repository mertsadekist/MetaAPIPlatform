export type Role =
  | "owner"
  | "analyst"
  | "client_manager"
  | "client_viewer";

export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  analyst: 3,
  client_manager: 2,
  client_viewer: 1,
};

export const PERMISSIONS = {
  // Client management
  VIEW_ALL_CLIENTS: ["owner"] as Role[],
  MANAGE_CLIENTS: ["owner"] as Role[],
  MANAGE_USERS: ["owner"] as Role[],
  CONNECT_META: ["owner"] as Role[],
  MANAGE_META_CONNECTIONS: ["owner"] as Role[],
  VIEW_AUDIT_LOGS: ["owner"] as Role[],
  MANAGE_SYSTEM_SETTINGS: ["owner"] as Role[],
  MANAGE_BILLING: ["owner"] as Role[],

  // Campaign actions
  TRIGGER_SYNC: ["owner", "analyst"] as Role[],
  ADD_COMPETITORS: ["owner", "analyst"] as Role[],
  CONFIGURE_ALERTS: ["owner", "analyst"] as Role[],

  // Lead / data actions
  UPDATE_LEAD_QUALITY: ["owner", "analyst", "client_manager"] as Role[],
  ADD_NOTES: ["owner", "analyst", "client_manager"] as Role[],
  DISMISS_RECOMMENDATIONS: [
    "owner",
    "analyst",
    "client_manager",
  ] as Role[],
  EXPORT_DATA: ["owner", "analyst", "client_manager"] as Role[],

  // View-only
  VIEW_CLIENT_DATA: [
    "owner",
    "analyst",
    "client_manager",
    "client_viewer",
  ] as Role[],
} as const;

export function hasPermission(
  userRole: Role,
  permission: keyof typeof PERMISSIONS
): boolean {
  const allowedRoles = PERMISSIONS[permission] as Role[];
  return allowedRoles.includes(userRole);
}

export function isAdminRole(role: Role): boolean {
  return role === "owner" || role === "analyst";
}
