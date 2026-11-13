"use client";

import { useEffect, useId, useState } from "react";
import { agentLabels, agentStages, credentialScope, matchingPreset, presetConfig, providerListSource, providerPresets, type AgentStage } from "@/lib/provider-catalog";
import type { AgentConfigs, ApiKeys, ProviderConfig } from "@/lib/types";

type PickerProps = {
  config: ProviderConfig;
  onChange: (config: ProviderConfig) => void;
  apiKeys: ApiKeys;
  onKeyChange: (scope: string, key: string) => void;
  configuredProviders?: string[];
  serverConfig?: ProviderConfig;
  hasServerKey?: boolean;
  allowDemo?: boolean;
};

export function ProviderPicker({ config, onChange, apiKeys, onKeyChange, configuredProviders = [], serverConfig, hasServerKey, allowDemo = true }: PickerProps) {
  const id = useId();
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<{ message: string; error?: boolean }>();
  const preset = matchingPreset(config);
  const scope = credentialScope(config);
  const key = apiKeys[scope] || "";
  const configured = (preset && configuredProviders.includes(preset.id)) || (hasServerKey && serverConfig?.provider === config.provider && credentialScope(serverConfig) === scope);
  const selection = config.provider === "demo" || config.provider === "ollama" ? config.provider : preset?.id || "custom";

  useEffect(() => { setModels([]); }, [scope]);
  useEffect(() => { setResult(undefined); }, [scope, config.model, key]);

  async function check(action: "models" | "test") {
    setBusy(action); setResult(undefined);
    try {
      const token = sessionStorage.getItem("dba-access-token");
      const response = await fetch("/api/providers", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action, config, apiKeys: key ? { [scope]: key } : {} }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Provider request failed.");
      if (action === "models") {
        setModels(body.models);
        setResult({ message: body.models.length ? `${body.models.length} available models loaded. Select one below; JSON support is checked separately.` : "No compatible free models were listed. Enter a model ID from the provider's documentation." });
      } else setResult({ message: `Connection and JSON response verified: ${body.model} (${body.durationMs} ms). This does not prove a full design will succeed.` });
    } catch (error) { setResult({ message: error instanceof Error ? error.message : "Connection failed.", error: true }); }
    finally { setBusy(""); }
  }

  return <div className="provider-picker">
    <label className="field-label" htmlFor={`${id}-provider`}>Provider</label>
    <select id={`${id}-provider`} value={selection} disabled={Boolean(busy)} onChange={event => onChange(presetConfig(event.target.value))}>
      {allowDemo && <option value="demo">Offline example · no real AI</option>}
      {!allowDemo && config.provider === "demo" && <option value="demo" disabled>Choose a live provider</option>}
      {providerPresets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      <option value="ollama">Ollama · local model</option><option value="custom">Custom OpenAI-compatible API</option>
    </select>
    {config.provider !== "demo" && <>
      <p className="helper-text">{preset?.note || "Use an OpenAI-compatible API with JSON-object chat completions. Enter the base URL, not the full chat/completions URL."}</p>
      <label className="field-label" htmlFor={`${id}-url`}>API base URL</label>
      <input id={`${id}-url`} type="url" required maxLength={300} value={config.baseUrl} onChange={event => onChange({ ...config, baseUrl: event.target.value })} />
      <label className="field-label" htmlFor={`${id}-key`}>Temporary API key <span>{preset?.anonymous || config.provider === "ollama" ? "Optional" : "Your own key required"}</span></label>
      <input id={`${id}-key`} type="password" autoComplete="off" maxLength={1000} value={key} onChange={event => onKeyChange(scope, event.target.value)} placeholder={configured ? "Server key configured for this endpoint" : preset?.anonymous ? "Leave blank for anonymous access" : "Paste your personal provider API key"} />
      {preset && !preset.anonymous && <a className="provider-key-link" href={preset.keyUrl} target="_blank" rel="noreferrer noopener">Get your own {preset.name} key</a>}
      <label className="field-label" htmlFor={`${id}-model`}>Model identifier</label>
      <input id={`${id}-model`} value={config.model} maxLength={120} onChange={event => onChange({ ...config, model: event.target.value })} placeholder="Load models or enter the exact model ID" />
      {models.length > 0 && <><label className="field-label" htmlFor={`${id}-models`}>Available models</label><select id={`${id}-models`} value={models.includes(config.model) ? config.model : ""} onChange={event => onChange({ ...config, model: event.target.value })}><option value="" disabled>Select a model</option>{models.map(model => <option key={model} value={model}>{model}</option>)}</select></>}
      <div className="button-row provider-actions"><button type="button" className="button button-secondary" disabled={Boolean(busy)} onClick={() => void check("models")}>{busy === "models" ? "Loading models…" : "Load models"}</button><button type="button" className="button button-secondary" disabled={Boolean(busy) || !config.model.trim()} onClick={() => void check("test")}>{busy === "test" ? "Testing…" : "Test connection"}</button></div>
      {result && <p className={`provider-result ${result.error ? "provider-error" : ""}`} role={result.error ? "alert" : "status"}>{result.message}</p>}
      <p className="helper-text">Keys stay in memory, scoped to this exact API endpoint, and clear on refresh. Free access can be rate-limited or unavailable.</p>
    </>}
    <p className="helper-text"><a href={providerListSource} target="_blank" rel="noreferrer noopener">Teacher's free-provider list</a> · No personal API keys are included or committed.</p>
  </div>;
}

export function AgentAssignment({ value, onChange, defaultConfig, onSave, initialStage = "intake", disabled, ...picker }: Omit<PickerProps, "config" | "onChange" | "allowDemo"> & {
  value: AgentConfigs;
  onChange: (configs: AgentConfigs) => void;
  defaultConfig: ProviderConfig;
  onSave: () => void;
  initialStage?: AgentStage;
  disabled?: boolean;
}) {
  const [stage, setStage] = useState<AgentStage>(initialStage);
  const id = useId();
  const override = value[stage];
  return <section className="panel agent-assignment"><span className="eyebrow">CHOOSE EACH WORKFLOW AGENT</span><h3>Provider & model per stage</h3><p className="helper-text">These are stage-specific model roles, not parallel autonomous agents. Stage 1 also calls the interview agent; stage 6 uses the repair agent only if validation fails.</p>
    <label className="field-label" htmlFor={`${id}-stage`}>Workflow agent</label><select id={`${id}-stage`} value={stage} onChange={event => setStage(event.target.value as AgentStage)}>{agentStages.map(item => <option key={item} value={item}>{agentLabels[item]}{value[item] ? " · custom" : " · workspace default"}</option>)}</select>
    <label className="inherit-provider"><input type="checkbox" checked={!override} onChange={event => { const next = { ...value }; if (event.target.checked) delete next[stage]; else next[stage] = defaultConfig.provider === "demo" ? presetConfig("kilo") : { ...defaultConfig }; onChange(next); }} />Use workspace default for this agent</label>
    {override ? <ProviderPicker {...picker} allowDemo={false} config={override} onChange={config => onChange({ ...value, [stage]: config })} /> : <p className="agent-default">{matchingPreset(defaultConfig)?.name || defaultConfig.provider} · {defaultConfig.model || "Choose a live default in Settings"}</p>}
    <button type="button" className="button button-secondary" disabled={disabled} onClick={onSave}>Save agent selections</button><p className="helper-text">Selections are also saved when you run a stage. API keys are never part of saved selections.</p>
  </section>;
}
