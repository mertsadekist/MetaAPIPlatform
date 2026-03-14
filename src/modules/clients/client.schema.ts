import { z } from "zod";

export const createClientSchema = z.object({
  displayName: z.string().min(1).max(200),
  industry: z.string().max(100).optional(),
  timezone: z.string().max(50).optional().default("UTC"),
  currencyCode: z.string().length(3).optional().default("USD"),
  logoUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateClientSchema = createClientSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const assignUserSchema = z.object({
  userId: z.string().uuid(),
  accessLevel: z.enum(["read", "manage"]),
});

export const kpiTargetSchema = z.object({
  targetLeads: z.number().int().positive().optional(),
  targetBudget: z.number().positive().optional(),
  targetCpl: z.number().positive().optional(),
  targetRoas: z.number().positive().optional(),
  targetCpql: z.number().positive().optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateClientData = z.infer<typeof createClientSchema>;
export type UpdateClientData = z.infer<typeof updateClientSchema>;
export type AssignUserData = z.infer<typeof assignUserSchema>;
export type KpiTargetData = z.infer<typeof kpiTargetSchema>;
