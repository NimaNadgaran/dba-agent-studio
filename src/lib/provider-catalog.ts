import type { ProviderConfig } from "./types";

export const providerPresets = [
  { id: "kilo", name: "Kilo Gateway (free, no key)", baseUrl: "https://ai-gateway.kilo.ai/api/v1", model: "kilo-auto/free", keyEnv: "KILO_API_KEY", keyUrl: "https://app.kilo.ai", anonymous: true, note: "Anonymous free models only. Shared limits apply; providers may log prompts. Use synthetic data, not confidential information." },
  { id: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-20b", keyEnv: "GROQ_API_KEY", keyUrl: "https://console.groq.com/keys", anonymous: false, note: "Personal API key required. Free-tier model quotas apply; check your account limits." },
  { id: "gemini", name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "", keyEnv: "GEMINI_API_KEY", keyUrl: "https://aistudio.google.com/apikey", anonymous: false, note: "Personal API key required. Load available models and choose one eligible for your free tier. Check data-use terms." },
  { id: "openrouter", name: "OpenRouter (free models)", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/free", keyEnv: "OPENROUTER_API_KEY", keyUrl: "https://openrouter.ai/settings/keys", anonymous: false, note: "Personal API key required. Only the free router and :free models are listed. Quotas and JSON support vary." },
] as const;

export const providerListSource = "https://github.com/mnfst/awesome-free-llm-apis";
export const agentStages = ["intake", "interview", "selection", "design", "revision", "repair"] as const;
export type AgentStage = typeof agentStages[number];
export const agentLabels: Record<AgentStage, string> = { intake: "Intake agent", interview: "Interview agent", selection: "DBMS selection agent", design: "Design agent", revision: "Revision agent", repair: "SQL repair agent" };

export function credentialScope(config: ProviderConfig): string {
  try { return new URL(config.baseUrl).toString().replace(/\/$/, ""); } catch { return config.baseUrl.replace(/\/$/, ""); }
}

export function matchingPreset(config: ProviderConfig) {
  return providerPresets.find(preset => credentialScope(config) === preset.baseUrl);
}

export function presetConfig(id: string): ProviderConfig {
  const preset = providerPresets.find(item => item.id === id);
  if (preset) return { provider: "compatible", baseUrl: preset.baseUrl, model: preset.model };
  if (id === "ollama") return { provider: "ollama", baseUrl: "http://localhost:11434/v1", model: "" };
  if (id === "demo") return { provider: "demo", baseUrl: "", model: "" };
  return { provider: "compatible", baseUrl: "", model: "" };
}

export function isFreeModel(model: string) {
  return model === "kilo-auto/free" || model === "openrouter/free" || model.endsWith(":free");
}
