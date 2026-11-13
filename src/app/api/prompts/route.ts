import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { authorize, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    authorize(request);
    const directory = path.join(process.cwd(), "prompts");
    const files = (await fs.readdir(directory)).filter(name => name.endsWith(".md")).sort();
    return NextResponse.json({ prompts: await Promise.all(files.map(async name => ({ name, content: await fs.readFile(path.join(directory, name), "utf8") }))) });
  } catch (error) { return errorResponse(error); }
}
