export interface CreateClientInput {
  displayName: string;
  industry?: string;
  timezone?: string;
  currencyCode?: string;
  logoUrl?: string;
  notes?: string;
}

export interface UpdateClientInput {
  displayName?: string;
  industry?: string;
  timezone?: string;
  currencyCode?: string;
  logoUrl?: string;
  notes?: string;
  isActive?: boolean;
}

export interface AssignUserInput {
  userId: string;
  accessLevel: "read" | "manage";
}

export interface KpiTargetInput {
  targetLeads?: number;
  targetBudget?: number;
  targetCpl?: number;
  targetRoas?: number;
  targetCpql?: number;
  notes?: string;
}
