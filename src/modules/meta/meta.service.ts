import prisma from "@/lib/db/client";
import { MetaApiClient, MetaError } from "@/lib/meta/client";
import { encryptToken, decryptToken } from "@/lib/meta/crypto";
import { logAuditEvent } from "@/lib/audit";
import type { ConnectMetaInput } from "./meta.schema";

export class MetaService {
  /** Validate a token and return info without saving */
  async validateToken(accessToken: string) {
    const api = new MetaApiClient(accessToken);
    try {
      const info = await api.validateToken();
      return { valid: true, ...info };
    } catch (e) {
      if (e instanceof MetaError) {
        return { valid: false, error: e.message };
      }
      throw e;
    }
  }

  /** Save a new Meta connection for a client */
  async connect(input: ConnectMetaInput, actorId: string) {
    // Validate token first
    const api = new MetaApiClient(input.accessToken);
    const info = await api.validateToken();

    const REQUIRED_SCOPES = ["ads_read", "business_management", "read_insights"];
    const missingScopes = REQUIRED_SCOPES.filter((s) => !info.scopes.includes(s));

    const encryptedToken = encryptToken(input.accessToken);

    const connection = await prisma.metaConnection.create({
      data: {
        clientId: input.clientId,
        connectionName: input.connectionName,
        authMode: input.authMode,
        metaAppId: input.metaAppId,
        accessTokenHash: encryptedToken,
        status: "active",
        tokenLastValidatedAt: new Date(),
        permissionsJson: { scopes: info.scopes, missingScopes },
      },
    });

    await logAuditEvent({
      eventType: "meta_connection_created",
      userId: actorId,
      clientId: input.clientId,
      entityRefId: connection.id,
      eventScope: "meta",
      metadata: { connectionName: input.connectionName, authMode: input.authMode },
    });

    return { connection, missingScopes };
  }

  /** List all connections for a client */
  async listConnections(clientId: string) {
    return prisma.metaConnection.findMany({
      where: { clientId },
      select: {
        id: true,
        connectionName: true,
        authMode: true,
        metaAppId: true,
        status: true,
        tokenLastValidatedAt: true,
        permissionsJson: true,
        createdAt: true,
        updatedAt: true,
        // Never expose the encrypted token
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Re-validate an existing connection */
  async revalidate(connectionId: string, actorId: string) {
    const conn = await prisma.metaConnection.findUnique({
      where: { id: connectionId },
    });
    if (!conn) throw new Error("Connection not found");

    const token = decryptToken(conn.accessTokenHash);
    const api = new MetaApiClient(token);

    try {
      const info = await api.validateToken();
      await prisma.metaConnection.update({
        where: { id: connectionId },
        data: {
          status: "active",
          tokenLastValidatedAt: new Date(),
          permissionsJson: { scopes: info.scopes },
        },
      });
      return { valid: true, scopes: info.scopes };
    } catch (e) {
      // Only mark as "error" for auth failures; leave "active" for transient issues
      const isAuthFailure = e instanceof MetaError && e.isAuthError;
      await prisma.metaConnection.update({
        where: { id: connectionId },
        data: { status: isAuthFailure ? "error" : "active" },
      });
      return { valid: false, error: String(e) };
    }
  }

  /** Delete a connection */
  async disconnect(connectionId: string, clientId: string, actorId: string) {
    await prisma.metaConnection.delete({
      where: { id: connectionId, clientId },
    });
    await logAuditEvent({
      eventType: "meta_connection_deleted",
      userId: actorId,
      clientId,
      entityRefId: connectionId,
      eventScope: "meta",
      metadata: {},
    });
  }
}

export const metaService = new MetaService();
