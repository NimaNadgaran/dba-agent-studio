import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, errorResponse, readBody } from "@/lib/http";
import { apiKeysSchema, providerSchema, type Session } from "@/lib/types";
import { callModel, listProviderModels, providerSecret } from "@/lib/provider";
import { newSession } from "@/lib/workflow";
import { saveProviderCheck } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let secret = "";
  let checkSession: Session | undefined;
  let saved = false;
  try {
    authorize(request);
    const body = await readBody(request, z.object({ action: z.enum(["models", "test"]), config: providerSchema, apiKeys: apiKeysSchema.optional() }));
    secret = providerSecret(body.config, body.apiKeys);
    if (body.action === "models") return NextResponse.json({ models: await listProviderModels(body.config, body.apiKeys) }, { headers: { "Cache-Control": "no-store" } });
    checkSession = newSession("Synthetic provider connection check. No user project data is sent.", body.config);
    await callModel(checkSession, "connection", z.object({ ok: z.literal(true) }), { instruction: "Return exactly {\"ok\":true}." }, body.apiKeys);
    const diagnosticId = await saveProviderCheck(checkSession.logs);
    saved = true;
    const log = checkSession.logs.at(-1)!;
    return NextResponse.json({ ok: true, diagnosticId, model: log.resolvedModel || log.model, durationMs: log.durationMs, attempts: log.attempt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (!saved && checkSession?.logs.length) {
      try { await saveProviderCheck(checkSession.logs); } catch (storageError) { return errorResponse(storageError); }
    }
    if (secret && error instanceof Error) error.message = error.message.replaceAll(secret, "[REDACTED]");
    return errorResponse(error);
  }
}
