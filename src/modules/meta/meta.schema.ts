import { z } from "zod";

export const connectMetaSchema = z.object({
  clientId: z.string().uuid(),
  connectionName: z.string().min(1).max(100),
  authMode: z.enum(["system_user", "user_token"]),
  accessToken: z.string().min(10),
  metaAppId: z.string().optional(),
});

export const validateTokenSchema = z.object({
  accessToken: z.string().min(10),
});

export type ConnectMetaInput = z.infer<typeof connectMetaSchema>;
export type ValidateTokenInput = z.infer<typeof validateTokenSchema>;
