import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { AppError, type ProviderConfig, type Session } from "./types";

export function environmentConfig(): ProviderConfig {
  const provider = process.env.LLM_PROVIDER;
  return { provider: provider === "compatible" || provider === "ollama" ? provider : "demo", model: process.env.LLM_MODEL || "", baseUrl: process.env.LLM_BASE_URL || (provider === "ollama" ? "http://localhost:11434/v1" : "https://api.openai.com/v1") };
}

function endpoint(config: ProviderConfig): string {
  let url: URL;
  try { url = new URL(config.baseUrl || environmentConfig().baseUrl); } catch { throw new AppError("Enter a valid provider base URL."); }
  if (url.username || url.password || url.search || url.hash) throw new AppError("The provider URL must not include credentials, query parameters or a fragment.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) throw new AppError("Use HTTPS for remote providers; HTTP is only allowed on localhost.");
  if (/^(169\.254\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(url.hostname) || url.hostname === "metadata.google.internal") throw new AppError("Private-network and metadata endpoints are not permitted.");
  return `${url.toString().replace(/\/$/, "")}/chat/completions`;
}

export function providerReady(config: ProviderConfig, apiKey?: string) {
  if (config.provider === "demo") return;
  endpoint(config);
  if (!config.model.trim()) throw new AppError("Choose a model in Settings before using live AI.");
  if (config.provider === "compatible" && !(apiKey || process.env.LLM_API_KEY)) throw new AppError("An API key is required. Set LLM_API_KEY in .env.local or enter a temporary key in Settings.");
}

export async function callModel<T>(session: Session, stage: string, schema: z.ZodType<T>, input: unknown, apiKey?: string, validate?: (result: T) => void): Promise<T> {
  providerReady(session.config, apiKey);
  if (session.config.provider === "demo") throw new AppError("Offline mode only supports its clearly labelled example. Use a live provider for arbitrary briefs.");
  const common = await fs.readFile(path.join(process.cwd(), "prompts", "system.md"), "utf8");
  const prompt = await fs.readFile(path.join(process.cwd(), "prompts", `${stage}.md`), "utf8");
  const contract = ["design", "revision", "repair"].includes(stage) ? await fs.readFile(path.join(process.cwd(), "prompts", "design-contract.md"), "utf8") : "";
  const selectionContract = stage === "revision" ? await fs.readFile(path.join(process.cwd(), "prompts", "selection.md"), "utf8") : "";
  const secret = apiKey || process.env.LLM_API_KEY || "";
  const redact = (value: string) => secret ? value.replaceAll(secret, "[REDACTED]") : value;
  const maxAttempts = Math.max(1, Math.min(4, Number(process.env.LLM_MAX_ATTEMPTS) || 3));
  const timeoutMs = Math.max(5000, Math.min(180000, Number(process.env.LLM_TIMEOUT_MS) || 90000));
  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = Date.now();
    const user = JSON.stringify({ data: input, ...(lastError ? { correctionRequired: lastError } : {}) });
    const messages = [{ role: "system", content: `${common}\n\n${prompt}\n\n${contract}\n\n${selectionContract}` }, { role: "user", content: user }];
    let output = "";
    try {
      const response = await fetch(endpoint(session.config), {
        method: "POST", redirect: "error", headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
        body: JSON.stringify({ model: session.config.model, messages, response_format: { type: "json_object" } }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await response.text();
      if (body.length > 2000000) throw new Error("The provider response exceeded the 2 MB safety limit.");
      if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}: ${body.slice(0, 1000)}`);
      const payload = JSON.parse(body);
      output = payload.choices?.[0]?.message?.content ?? "";
      if (!output) throw new Error("Provider returned no text content.");
      if (payload.choices?.[0]?.finish_reason === "length") throw new Error("The model output was truncated. Use a model with sufficient output capacity or reduce scope.");
      const parsed = schema.parse(JSON.parse(output.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "")));
      validate?.(parsed);
      session.logs.push({ id: randomUUID(), at: new Date().toISOString(), stage, provider: session.config.provider, model: session.config.model, attempt, durationMs: Date.now() - started, status: "success", input: redact(JSON.stringify(messages)), output: redact(output) });
      return parsed;
    } catch (error) {
      lastError = redact(error instanceof Error ? error.message : String(error));
      session.logs.push({ id: randomUUID(), at: new Date().toISOString(), stage, provider: session.config.provider, model: session.config.model, attempt, durationMs: Date.now() - started, status: "error", input: redact(JSON.stringify(messages)), output: redact(output), error: lastError });
      if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, attempt * 350));
    }
  }
  throw new AppError(`The ${stage} stage could not complete after ${maxAttempts} attempts. ${lastError}`, 502);
}

export function recordDemo(session: Session, stage: string, input: unknown, output: unknown) {
  session.logs.push({ id: randomUUID(), at: new Date().toISOString(), stage, provider: "offline-fixture", model: "deterministic-example (no LLM call)", attempt: 1, durationMs: 0, status: "success", input: JSON.stringify(input, null, 2), output: JSON.stringify(output, null, 2) });
}
