import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, errorResponse, readBody } from "@/lib/http";
import { readSession, saveSession, withSessionLock } from "@/lib/store";
import { AppError, providerSchema } from "@/lib/types";
import { transition } from "@/lib/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
type Params = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Params) {
  try { authorize(request); return NextResponse.json({ session: await readSession((await params).id) }); } catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest, { params }: Params) {
  try {
    authorize(request);
    const body = await readBody(request, z.object({ action: z.enum(["intake", "interview", "selection", "design", "revision", "approve", "sql", "config"]), version: z.number().int().min(1), answers: z.record(z.string(), z.string().max(12000)).optional(), request: z.string().max(12000).optional(), config: providerSchema.optional(), apiKey: z.string().max(1000).optional() }));
    const id = (await params).id;
    return await withSessionLock(id, async () => {
      const session = await readSession(id);
      if (session.version !== body.version) throw new AppError("This workspace changed in another tab. Reload it before continuing.", 409);
      const original = structuredClone(session);
      try { await transition(session, body); }
      catch (error) {
        original.logs = session.logs;
        await saveSession(original);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Stage failed.", session: original }, { status: error instanceof AppError ? error.status : 500 });
      }
      await saveSession(session);
      return NextResponse.json({ session });
    });
  } catch (error) { return errorResponse(error); }
}
