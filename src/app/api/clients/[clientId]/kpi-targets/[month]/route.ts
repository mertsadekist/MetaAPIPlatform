import { NextRequest, NextResponse } from "next/server";
import {
  requireClientAccess,
  requireRole,
  handleAuthError,
} from "@/lib/auth/guards";
import { clientService } from "@/modules/clients/client.service";
import { kpiTargetSchema } from "@/modules/clients/client.schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; month: string }> }
) {
  try {
    const { clientId, month } = await params;
    await requireClientAccess(clientId);
    const target = await clientService.getKpiTargets(clientId, month);
    if (!target)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(target);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; month: string }> }
) {
  try {
    const { clientId, month } = await params;
    await requireRole(["owner", "analyst"]);
    const body = await req.json();
    const data = kpiTargetSchema.parse(body);

    // Validate month format YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "Invalid month format. Use YYYY-MM" },
        { status: 400 }
      );
    }

    const target = await clientService.setKpiTargets(clientId, month, data);
    return NextResponse.json(target);
  } catch (error) {
    return handleAuthError(error);
  }
}
