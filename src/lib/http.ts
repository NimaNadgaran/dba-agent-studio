import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "./types";

export function authorize(request: NextRequest) {
  const token = process.env.APP_ACCESS_TOKEN;
  if (process.env.VERCEL && !token) throw new AppError("Set APP_ACCESS_TOKEN before hosting this private workspace.", 503);
  if (token) {
    const provided = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const expected = Buffer.from(token);
    const actual = Buffer.from(provided);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new AppError("Access token required. Enter it in Settings.", 401);
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin && new URL(origin).host !== request.headers.get("host")) throw new AppError("Cross-origin requests are not allowed.", 403);
    if (!request.headers.get("content-type")?.includes("application/json")) throw new AppError("Use application/json requests.", 415);
  }
}

export async function readBody<Schema extends z.ZodTypeAny>(request: NextRequest, schema: Schema): Promise<z.output<Schema>> {
  const text = await request.text();
  if (Buffer.byteLength(text) > 262144) throw new AppError("Request exceeds the 256 KB limit.", 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new AppError("Invalid JSON request."); }
  return schema.parse(body);
}

export function errorResponse(error: unknown) {
  const status = error instanceof AppError ? error.status : error instanceof z.ZodError ? 400 : 500;
  const message = error instanceof z.ZodError ? error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") : error instanceof Error ? error.message : "Unexpected error.";
  if (status === 500) console.error(error);
  return NextResponse.json({ error: status === 500 ? "The operation could not be saved. Check the server terminal and try again." : message }, { status });
}
