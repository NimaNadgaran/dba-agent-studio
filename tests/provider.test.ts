import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { z } from "zod";
import { callModel, environmentConfig, listProviderModels, providerReady, providerSecret } from "../src/lib/provider";
import { credentialScope, presetConfig } from "../src/lib/provider-catalog";
import { agentConfigsSchema } from "../src/lib/types";
import { demoAnswers, newSession, transition } from "../src/lib/workflow";
import { demoChoice, demoDesign } from "../src/lib/demo";
import type { Session } from "../src/lib/types";

async function mockProvider(responses: (string | object)[]) {
  const calls: { authorization?: string; body: Record<string, unknown> }[] = [];
  const server: Server = createServer(async (request, response) => {
    let text = "";
    for await (const chunk of request) text += chunk;
    calls.push({ authorization: request.headers.authorization, body: text ? JSON.parse(text) : {} });
    const value = responses.shift();
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(request.method === "GET" ? value : { model: "resolved-mock-model", choices: [{ finish_reason: "stop", message: { content: typeof value === "string" ? value : JSON.stringify(value) } }] }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server address");
  return { calls, url: `http://127.0.0.1:${address.port}/v1`, close: () => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }) };
}

test("live adapter retries malformed JSON, logs all attempts, and redacts secrets", async () => {
  const provider = await mockProvider(["invalid JSON", { result: "corrected" }]);
  try {
    const session = newSession("Design an independent wildlife rescue register for rehabilitation staff.", { provider: "compatible", model: "mock-unseen-model", baseUrl: provider.url });
    const result = await callModel(session, "intake", z.object({ result: z.string() }), { note: "mock-private-key" }, "mock-private-key");
    assert.equal(result.result, "corrected"); assert.equal(provider.calls.length, 2);
    assert.equal(session.logs[0].status, "error"); assert.equal(session.logs[1].attempt, 2);
    assert.ok(!JSON.stringify(session.logs).includes("mock-private-key"));
    assert.equal(provider.calls[0].authorization, "Bearer mock-private-key");
    assert.ok(JSON.stringify(provider.calls[1].body).includes("correctionRequired"));
  } finally { await provider.close(); }
});

test("provider configuration enforces credentials and safe endpoints", () => {
  assert.throws(() => providerReady({ provider: "compatible", model: "", baseUrl: "https://api.example.org/v1" }), /Choose a model/);
  assert.throws(() => providerReady({ provider: "compatible", model: "model", baseUrl: "https://169.254.169.254" }, "key"), /metadata endpoints/);
  assert.throws(() => providerReady({ provider: "compatible", model: "model", baseUrl: "http://untrusted.example.org" }, "key"), /Use HTTPS/);
  assert.throws(() => providerReady({ provider: "compatible", model: "model", baseUrl: "https://user:password@example.org" }, "key"), /credentials/);
  assert.doesNotThrow(() => providerReady({ provider: "ollama", model: "local-model", baseUrl: "http://localhost:11434/v1" }));
});

test("catalog supports anonymous free models but rejects paid models in free presets", () => {
  assert.doesNotThrow(() => providerReady(presetConfig("kilo")));
  assert.throws(() => providerReady({ ...presetConfig("kilo"), model: "a-paid-model" }), /only permits/);
  assert.throws(() => providerReady({ provider: "compatible", model: "mock", baseUrl: "https://requires-key.example.org/v1" }), /API key/);
  assert.equal(agentConfigsSchema.parse({ design: presetConfig("kilo") }).design?.model, "kilo-auto/free");
  assert.throws(() => agentConfigsSchema.parse({ nonexistent: presetConfig("kilo") }));
});

test("fresh installations default to a real anonymous model and retain explicit offline mode", () => {
  const previous = { provider: process.env.LLM_PROVIDER, model: process.env.LLM_MODEL, url: process.env.LLM_BASE_URL };
  try {
    delete process.env.LLM_PROVIDER; delete process.env.LLM_MODEL; delete process.env.LLM_BASE_URL;
    assert.deepEqual(environmentConfig(), presetConfig("kilo"));
    process.env.LLM_PROVIDER = "demo";
    assert.equal(newSession("").mode, "demo");
    process.env.LLM_PROVIDER = "compatible"; process.env.LLM_BASE_URL = "https://other.example.org/v1";
    assert.equal(environmentConfig().model, "");
  } finally {
    for (const [name, value] of Object.entries({ LLM_PROVIDER: previous.provider, LLM_MODEL: previous.model, LLM_BASE_URL: previous.url })) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});

test("server and browser keys are scoped to the intended endpoint", () => {
  const previous = { provider: process.env.LLM_PROVIDER, url: process.env.LLM_BASE_URL, key: process.env.LLM_API_KEY, groq: process.env.GROQ_API_KEY };
  try {
    process.env.LLM_PROVIDER = "compatible"; process.env.LLM_BASE_URL = "https://trusted.example.org/v1"; process.env.LLM_API_KEY = "private-default-key"; process.env.GROQ_API_KEY = "private-groq-key";
    const custom = { provider: "compatible" as const, baseUrl: "https://other.example.org/v1", model: "model" };
    assert.equal(providerSecret(custom), "");
    assert.equal(providerSecret({ ...custom, baseUrl: process.env.LLM_BASE_URL }), "private-default-key");
    assert.equal(providerSecret(presetConfig("groq")), "private-groq-key");
    assert.equal(providerSecret({ ...presetConfig("groq"), baseUrl: "https://other.example.org/v1" }), "");
    assert.equal(providerSecret(custom, { [credentialScope(presetConfig("groq"))]: "temporary-groq-key" }), "");
    assert.equal(providerSecret(custom, { [credentialScope(custom)]: "scoped-key" }), "scoped-key");
  } finally {
    for (const [name, value] of Object.entries({ LLM_PROVIDER: previous.provider, LLM_BASE_URL: previous.url, LLM_API_KEY: previous.key, GROQ_API_KEY: previous.groq })) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});

test("model discovery uses the adapter and returns bounded distinct identifiers", async () => {
  const provider = await mockProvider([{ data: [{ id: "model-b" }, { id: "model-a" }, { id: "model-a" }, { id: null }, { id: "" }] }]);
  try {
    const models = await listProviderModels({ provider: "ollama", model: "", baseUrl: provider.url });
    assert.deepEqual(models, ["model-a", "model-b"]);
  } finally { await provider.close(); }
});

test("each live stage uses its selected provider and key without saving secrets", async () => {
  const first = await mockProvider([{ result: "intake" }]);
  const second = await mockProvider([{ result: "design" }]);
  try {
    const config = { provider: "compatible" as const, model: "first-model", baseUrl: first.url };
    const alternate = { provider: "compatible" as const, model: "second-model", baseUrl: second.url };
    const session = newSession("An unseen equipment lending club manages members and tools.", config, { design: alternate });
    const apiKeys = { [credentialScope(config)]: "private-first-key", [credentialScope(alternate)]: "private-second-key" };
    await callModel(session, "intake", z.object({ result: z.string() }), {}, apiKeys);
    await callModel(session, "design", z.object({ result: z.string() }), {}, apiKeys);
    assert.equal(first.calls[0].authorization, "Bearer private-first-key");
    assert.equal(second.calls[0].authorization, "Bearer private-second-key");
    assert.equal(second.calls[0].body.model, "second-model");
    assert.equal(session.logs[1].model, "second-model");
    assert.equal(session.logs[1].resolvedModel, "resolved-mock-model");
    assert.ok(!JSON.stringify(session).includes("private-first-key"));
    assert.ok(!JSON.stringify(session).includes("private-second-key"));
    await transition(session, { action: "config", agentConfigs: { interview: alternate } });
    assert.equal(session.agentConfigs?.design, undefined);
    assert.equal(session.agentConfigs?.interview?.model, "second-model");
    await assert.rejects(() => transition(session, { action: "config", agentConfigs: { design: { provider: "demo", model: "", baseUrl: "" } } }), /live providers/);
  } finally { await first.close(); await second.close(); }
});

test("automatic repair is bounded, records real failure, and requires fresh approval", async () => {
  const broken = demoDesign(); broken.tables.find(table => table.name === "spaces")!.rows[0].capacity = -2;
  const provider = await mockProvider([demoDesign()]);
  try {
    const session = newSession("A multi-location coworking system requiring reliable reservations and invoices.", { provider: "ollama", model: "mock-repair", baseUrl: provider.url });
    session.design = broken; session.designVersion = 1; session.choice = { ...structuredClone(demoChoice), selected: "SQLite" }; session.approvedAt = new Date().toISOString(); session.stage = 6; session.completedStages = [1, 2, 3, 4, 5];
    await transition(session, { action: "sql" });
    assert.equal(session.validationHistory.length, 2);
    assert.equal(session.validationHistory[0].status, "failed"); assert.equal(session.validationHistory[1].status, "passed");
    assert.equal(session.approvedAt, undefined); assert.equal(session.stage, 5); assert.equal(session.designVersion, 2);
    assert.equal(session.artifacts["schema.sql"], undefined); assert.equal(session.changes.length, 1);
    assert.ok(JSON.stringify(provider.calls[0].body).includes("CHECK constraint failed"));
    await transition(session, { action: "approve" }); await transition(session, { action: "sql" });
    assert.equal((session as Session).validation?.status, "passed"); assert.ok(session.artifacts["seed.sql"]);
  } finally { await provider.close(); }
});

test("live stage transitions use the configured adapter instead of the offline fixture", async () => {
  const intake = { title: "Wildlife rehabilitation", summary: "A wildlife rehabilitation centre records animals, habitats, and care observations for rescued birds and mammals.", actors: ["Rehabilitation staff"], entities: ["Animals", "Care records"], processes: ["Admit a rescued animal"], risks: ["Clarify release dates"] };
  const initial = { ready: false, rationale: "Clarify all requirement categories before creating a rescue register.", summary: "", questions: ["Entities & attributes", "Relationships & cardinality", "Volume & growth", "Queries & reporting", "Transactions & concurrency", "Security & privacy", "Business rules"].map((category, index) => ({ id: `wildlife_${index}`, category, question: `What are the wildlife centre's requirements for ${category.toLowerCase()}?`, hint: "Describe the rescue workflow." })) };
  const followup = { ready: false, rationale: "The animal transfer answer needs a retention clarification.", summary: "Animal admission and care events require history.", questions: [{ id: "retention", category: "Business rules", question: "You retain care events: should release anonymize the reporter or delete the event?", hint: "Clarify audit retention." }] };
  const ready = { ready: true, rationale: "All categories and the targeted retention follow-up are answered.", summary: "Rescued animals have unique case numbers, a species and an admission date. Care observations are retained for audit, staff access is restricted, volumes are low, and concurrent writes are rare. Use an offline SQLite database for this single workstation.", questions: [] };
  const provider = await mockProvider([intake, initial, followup, ready]);
  try {
    const session = newSession("Design a wildlife rehabilitation register, not a coworking system. Track rescued animals and their retained care history.", { provider: "ollama", model: "mock-wildlife", baseUrl: provider.url });
    await transition(session, { action: "intake" });
    assert.equal(session.title, "Wildlife rehabilitation"); assert.ok(session.description.includes("wildlife"));
    const answers = Object.fromEntries(initial.questions.map(question => [question.id, "Rescued animals and staff care events, retained for audit after release."]));
    await transition(session, { action: "interview", answers }); assert.equal(session.interview.ready, false);
    await transition(session, { action: "interview", answers: { retention: "Retain all care events and use pseudonymous reporter IDs." } });
    assert.equal(session.interview.ready, true); assert.equal(session.logs.length, 4);
    assert.ok(session.logs.every(log => log.provider === "ollama"));
    assert.ok(!session.artifacts["intake.md"].content.includes("Lumina"));
    assert.ok(JSON.stringify(provider.calls[2].body).includes(answers.wildlife_0));
  } finally { await provider.close(); }
});
