import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { AppError, type ApiKeys, type ProviderConfig, type Session } from "./types";
import { credentialScope, isFreeModel, matchingPreset, presetConfig } from "./provider-catalog";

export function environmentConfig(): ProviderConfig {
  const provider = process.env.LLM_PROVIDER === "demo" ? "demo" : process.env.LLM_PROVIDER === "ollama" ? "ollama" : "compatible";
  const fallback = presetConfig(provider === "compatible" ? "kilo" : provider);
  const baseUrl = process.env.LLM_BASE_URL || fallback.baseUrl;
  const model = process.env.LLM_MODEL || (credentialScope({ ...fallback, baseUrl }) === credentialScope(fallback) ? fallback.model : "");
  return { provider, model, baseUrl };
}

export function endpoint(config: ProviderConfig, resource = "chat/completions"): string {
  let url: URL;
  try { url = new URL(config.baseUrl || environmentConfig().baseUrl); } catch { throw new AppError("Enter a valid provider base URL."); }
  if (url.username || url.password || url.search || url.hash) throw new AppError("The provider URL must not include credentials, query parameters or a fragment.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) throw new AppError("Use HTTPS for remote providers; HTTP is only allowed on localhost.");
  if (/^(169\.254\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|\[(fc|fd|fe80|::ffff:))/i.test(url.hostname) || url.hostname === "metadata.google.internal") throw new AppError("Private-network and metadata endpoints are not permitted.");
  return `${url.toString().replace(/\/$/, "")}/${resource}`;
}

export function providerSecret(config: ProviderConfig, apiKeys?: string | ApiKeys): string {
  const temporary = typeof apiKeys === "string" ? apiKeys : apiKeys?.[credentialScope(config)];
  if (temporary) return temporary;
  const preset = matchingPreset(config);
  if (preset && process.env[preset.keyEnv]) return process.env[preset.keyEnv]!;
  const environment = environmentConfig();
  return process.env.LLM_BASE_URL && environment.provider === config.provider && credentialScope(environment) === credentialScope(config) ? process.env.LLM_API_KEY || "" : "";
}

export function providerReady(config: ProviderConfig, apiKeys?: string | ApiKeys, requireModel = true) {
  if (config.provider === "demo") return;
  endpoint(config);
  if (requireModel && !config.model.trim()) throw new AppError("Choose a model before using live AI. Load models or enter an exact model ID.");
  const preset = matchingPreset(config);
  if (requireModel && (preset?.id === "kilo" || preset?.id === "openrouter") && !isFreeModel(config.model)) throw new AppError("This free preset only permits the free router or a :free model. Use a custom provider explicitly for paid models.");
  if (config.provider === "compatible" && !preset?.anonymous && !providerSecret(config, apiKeys)) throw new AppError(`An API key is required for this provider. Set ${preset?.keyEnv || "LLM_API_KEY"} in .env.local or enter your own temporary key. Keys are not supplied by the provider list.`);
}

async function boundedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 2000000) { await reader.cancel(); throw new AppError("The provider response exceeded the 2 MB safety limit.", 502); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}

export async function listProviderModels(config: ProviderConfig, apiKeys?: string | ApiKeys): Promise<string[]> {
  if (config.provider === "demo") throw new AppError("The offline fixture has no live models.");
  providerReady(config, apiKeys, false);
  const secret = providerSecret(config, apiKeys);
  const response = await fetch(endpoint(config, "models"), { redirect: "error", headers: secret ? { Authorization: `Bearer ${secret}` } : {}, signal: AbortSignal.timeout(20000), cache: "no-store" });
  if (!response.ok) throw new AppError(`Could not load models (HTTP ${response.status}). Check your endpoint, key and provider availability.`, 502);
  const payload = JSON.parse(await boundedText(response));
  if (!Array.isArray(payload.data)) throw new AppError("The provider returned an invalid model list. Enter an exact model ID or check its API compatibility.", 502);
  const preset = matchingPreset(config);
  const models = (payload.data ?? []).map((model: { id?: unknown }) => model.id).filter((id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 120);
  return [...new Set<string>(models)].filter(id => !["kilo", "openrouter"].includes(preset?.id ?? "") || isFreeModel(id)).sort();
}

export async function callModel<T>(session: Session, stage: string, schema: z.ZodType<T>, input: unknown, apiKey?: string | ApiKeys, validate?: (result: T) => void): Promise<T> {
  const config = session.agentConfigs?.[stage as keyof NonNullable<Session["agentConfigs"]>] ?? session.config;
  providerReady(config, apiKey);
  if (config.provider === "demo") throw new AppError("Offline mode only supports its clearly labelled example. Use a live provider for arbitrary briefs.");
  const common = await fs.readFile(path.join(process.cwd(), "prompts", "system.md"), "utf8");
  const prompt = await fs.readFile(path.join(process.cwd(), "prompts", `${stage}.md`), "utf8");
  const contract = ["design", "revision", "repair"].includes(stage) ? await fs.readFile(path.join(process.cwd(), "prompts", "design-contract.md"), "utf8") : "";
  const selectionContract = stage === "revision" ? await fs.readFile(path.join(process.cwd(), "prompts", "selection.md"), "utf8") : "";
  const secret = providerSecret(config, apiKey);
  const secrets = [secret, ...(typeof apiKey === "object" ? Object.values(apiKey) : [])].filter(Boolean);
  const redact = (value: string) => secrets.reduce((text, key) => text.replaceAll(key, "[REDACTED]"), value);
  const maxAttempts = Math.max(1, Math.min(4, Number(process.env.LLM_MAX_ATTEMPTS) || 3));
  const timeoutMs = Math.max(5000, Math.min(180000, Number(process.env.LLM_TIMEOUT_MS) || 90000));
  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = Date.now();
    const user = JSON.stringify({ data: input, ...(lastError ? { correctionRequired: lastError } : {}) });
    const messages = [{ role: "system", content: `${common}\n\n${prompt}\n\n${contract}\n\n${selectionContract}` }, { role: "user", content: user }];
    let output = "";
    try {
      const response = await fetch(endpoint(config), {
        method: "POST", redirect: "error", headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
        body: JSON.stringify({ model: config.model, messages, response_format: { type: "json_object" } }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await boundedText(response);
      if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}: ${body.slice(0, 1000)}`);
      const payload = JSON.parse(body);
      output = payload.choices?.[0]?.message?.content ?? "";
      if (!output) throw new Error("Provider returned no text content.");
      if (payload.choices?.[0]?.finish_reason === "length") throw new Error("The model output was truncated. Use a model with sufficient output capacity or reduce scope.");
      const parsed = schema.parse(JSON.parse(output.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "")));
      validate?.(parsed);
      session.logs.push({ id: randomUUID(), at: new Date().toISOString(), stage, provider: matchingPreset(config)?.id || config.provider, model: config.model, baseUrl: config.baseUrl, resolvedModel: typeof payload.model === "string" ? payload.model : undefined, attempt, durationMs: Date.now() - started, status: "success", input: redact(JSON.stringify(messages)), output: redact(output) });
      return parsed;
    } catch (error) {
      lastError = redact(error instanceof Error ? error.message : String(error));
      session.logs.push({ id: randomUUID(), at: new Date().toISOString(), stage, provider: matchingPreset(config)?.id || config.provider, model: config.model, baseUrl: config.baseUrl, attempt, durationMs: Date.now() - started, status: "error", input: redact(JSON.stringify(messages)), output: redact(output), error: lastError });
      if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, attempt * 350));
    }
  }
  throw new AppError(`The ${stage} stage could not complete after ${maxAttempts} attempts. ${lastError}`, 502);
}

export function recordDemo(session: Session, stage: string, input: unknown, output: unknown) {
  session.logs.push({ id: randomUUID(), at: new Date().toISOString(), stage, provider: "offline-fixture", model: "deterministic-example (no LLM call)", attempt: 1, durationMs: 0, status: "success", input: JSON.stringify(input, null, 2), output: JSON.stringify(output, null, 2) });
}
