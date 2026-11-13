import { NextRequest } from "next/server";
import JSZip from "jszip";
import { authorize, errorResponse } from "@/lib/http";
import { readSession } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    authorize(request);
    const session = await readSession((await params).id);
    const zip = new JSZip();
    for (const item of Object.values(session.artifacts)) zip.file(item.name, item.content);
    zip.file("llm-calls.json", JSON.stringify(session.logs, null, 2));
    zip.file("session.json", JSON.stringify(session, null, 2));
    zip.file("EXPORT-README.md", `# ${session.title}\n\nDesign version ${session.designVersion}.\n\nMode: ${session.mode === "demo" ? "Offline illustrative fixture — no LLM used" : "Live AI"}.\n\nApproval: ${session.approvedAt || "Not approved"}.\n\nValidation: ${session.validation?.status || "Not run"} (${session.validation?.engine || "no engine"}).\n\nRun schema.sql and then seed.sql in a new empty ${session.choice?.selected || "target"} database. No CREATE DATABASE privileges are required. Review requirements and businessRules in design.json before production; cross-row and authorization rules need application transactions.\n\nThis ZIP includes potentially sensitive briefs, interview answers, and LLM traces. Share it deliberately. No API key is included.\n`);
    const buffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    return new Response(buffer as BodyInit, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="dba-agent-${session.id.slice(0, 8)}-v${session.designVersion}.zip"`, "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
