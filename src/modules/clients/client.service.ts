import prisma from "@/lib/db/client";
import type {
  CreateClientInput,
  UpdateClientInput,
  AssignUserInput,
  KpiTargetInput,
} from "./client.types";

export class ClientService {
  async listClients(userId?: string, userRole?: string) {
    if (userRole === "owner" || userRole === "analyst") {
      return prisma.client.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { adAccounts: true, leads: true } },
        },
      });
    }

    // For client_manager and client_viewer, only return assigned clients
    return prisma.client.findMany({
      where: {
        userAccess: { some: { userId } },
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { adAccounts: true, leads: true } },
      },
    });
  }

  async getClient(id: string) {
    return prisma.client.findUnique({
      where: { id },
      include: {
        userAccess: {
          include: { user: { select: { id: true, username: true, role: true, displayName: true } } },
        },
        adAccounts: true,
        metaConnections: { select: { id: true, connectionName: true, status: true } },
        _count: { select: { leads: true, competitors: true } },
      },
    });
  }

  async createClient(data: CreateClientInput) {
    return prisma.client.create({
      data: {
        displayName: data.displayName,
        industry: data.industry,
        timezone: data.timezone ?? "UTC",
        currencyCode: data.currencyCode ?? "USD",
        logoUrl: data.logoUrl,
        notes: data.notes,
      },
    });
  }

  async updateClient(id: string, data: UpdateClientInput) {
    return prisma.client.update({
      where: { id },
      data,
    });
  }

  async deleteClient(id: string) {
    return prisma.client.delete({ where: { id } });
  }

  async assignUser(clientId: string, data: AssignUserInput) {
    return prisma.clientUserAccess.upsert({
      where: {
        clientId_userId: { clientId, userId: data.userId },
      },
      update: { accessLevel: data.accessLevel },
      create: {
        clientId,
        userId: data.userId,
        accessLevel: data.accessLevel,
      },
    });
  }

  async removeUser(clientId: string, userId: string) {
    return prisma.clientUserAccess.delete({
      where: { clientId_userId: { clientId, userId } },
    });
  }

  async listUsers(clientId: string) {
    return prisma.clientUserAccess.findMany({
      where: { clientId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
  }

  async setKpiTargets(
    clientId: string,
    monthYear: string,
    targets: KpiTargetInput
  ) {
    return prisma.clientKpiTarget.upsert({
      where: { clientId_monthYear: { clientId, monthYear } },
      update: {
        targetLeads: targets.targetLeads,
        targetBudget: targets.targetBudget,
        targetCpl: targets.targetCpl,
        targetRoas: targets.targetRoas,
        targetCpql: targets.targetCpql,
        notes: targets.notes,
      },
      create: {
        clientId,
        monthYear,
        targetLeads: targets.targetLeads,
        targetBudget: targets.targetBudget,
        targetCpl: targets.targetCpl,
        targetRoas: targets.targetRoas,
        targetCpql: targets.targetCpql,
        notes: targets.notes,
      },
    });
  }

  async getKpiTargets(clientId: string, monthYear: string) {
    return prisma.clientKpiTarget.findUnique({
      where: { clientId_monthYear: { clientId, monthYear } },
    });
  }

  async listKpiTargets(clientId: string) {
    return prisma.clientKpiTarget.findMany({
      where: { clientId },
      orderBy: { monthYear: "desc" },
    });
  }
}

export const clientService = new ClientService();
