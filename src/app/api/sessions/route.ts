import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, errorResponse, readBody } from "@/lib/http";
import { listSessions, saveSession } from "@/lib/store";
import { AppError, agentConfigsSchema, providerSchema } from "@/lib/types";
import { newSession } from "@/lib/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try { authorize(request); return NextResponse.json({ sessions: await listSessions() }); } catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    authorize(request);
    const body = await readBody(request, z.object({ description: z.string().max(30000).default(""), config: providerSchema.optional(), agentConfigs: agentConfigsSchema.optional() }));
    if (body.config?.provider !== "demo" && body.description.trim().length < 30) throw new AppError("Please describe your system in at least 30 characters.");
    if ((await listSessions()).length >= 300) throw new AppError("Workspace limit reached. Archive local data before creating more.", 409);
    const session = newSession(body.description, body.config, body.agentConfigs);
    await saveSession(session);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
