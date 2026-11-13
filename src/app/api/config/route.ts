import { NextRequest, NextResponse } from "next/server";
import { authorize, errorResponse } from "@/lib/http";
import { environmentConfig } from "@/lib/provider";
import { storageStatus } from "@/lib/store";
import { providerPresets } from "@/lib/provider-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    authorize(request);
    return NextResponse.json({ config: environmentConfig(), hasApiKey: Boolean(process.env.LLM_API_KEY), configuredProviders: providerPresets.filter(preset => Boolean(process.env[preset.keyEnv])).map(preset => preset.id), storage: storageStatus(), engines: ["PostgreSQL · execution", "SQLite · execution", "MySQL · structural", "SQL Server · structural"] });
  } catch (error) { return errorResponse(error); }
}
