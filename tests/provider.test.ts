import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { z } from "zod";
import { callModel, environmentConfig, listProviderModels, providerReady, providerSecret } from "../src/lib/provider";
import { normalizeApiKey, credentialScope, presetConfig } from "../src/lib/provider-catalog";
import { agentConfigsSchema } from "../src/lib/types";
import { demoAnswers, draftInterviewAnswers, newSession, transition } from "../src/lib/workflow";
import { demoChoice, demoDesign } from "../src/lib/demo";
import type { Design, Session } from "../src/lib/types";
import { orderedTables } from "../src/lib/design";

async function mockProvider(responses: (string | object)[]) {
  const calls: { authorization?: string; body: Record<string, unknown> }[] = [];
  const server: Server = createServer(async (request, response) => {
    let text = "";
    for await (const chunk of request) text += chunk;
    calls.push({ authorization: request.headers.authorization, body: text ? JSON.parse(text) : {} });
    const value = responses.shift();
    if (value && typeof value === "object" && "mockNoResponse" in value) return;
    if (value && typeof value === "object" && "mockStatus" in value) {
      response.writeHead(Number(value.mockStatus), { "content-type": "application/json" });
      response.end(JSON.stringify("mockBody" in value ? value.mockBody : {}));
      return;
    }
    response.setHeader("content-type", "application/json");
    const completion = value && typeof value === "object" && "mockFinishReason" in value ? { finish_reason: value.mockFinishReason, message: { content: JSON.stringify("mockContent" in value ? value.mockContent : {}) } } : { finish_reason: "stop", message: { content: typeof value === "string" ? value : JSON.stringify(value) } };
    response.end(JSON.stringify(request.method === "GET" ? value : { model: "resolved-mock-model", choices: [completion], usage: value && typeof value === "object" && "mockUsage" in value ? value.mockUsage : undefined }));
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

test("quota and authentication failures stop immediately, identify the credential source, and redact keys", async () => {
  for (const status of [401, 403, 429]) {
    const secret = "synthetic-quota-key";
    const provider = await mockProvider([{ mockStatus: status, mockBody: { error: { code: status === 401 ? "invalid_api_key" : "insufficient_user_quota", message: status === 401 ? "Invalid API key " + secret : "Rejected " + secret + ": insufficient user quota" } } }]);
    try {
      const session = newSession("Design a wildlife register for rehabilitation staff.", { provider: "compatible", model: "quota-model", baseUrl: provider.url });
      await assert.rejects(() => callModel(session, "design", z.object({ ok: z.boolean() }), {}, secret), error => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /stopped after 1 attempt/);
        assert.ok(error.message.includes(provider.url));
        assert.match(error.message, /Credential: temporary key/);
        assert.ok(!error.message.includes(secret));
        return true;
      });
      assert.equal(provider.calls.length, 1);
      assert.equal(session.logs.length, 1);
      assert.ok(!JSON.stringify(session.logs).includes(secret));
    } finally { await provider.close(); }
  }
});

test("temporary upstream failures and rate limits remain retryable", async () => {
  for (const status of [429, 503]) {
    const provider = await mockProvider([{ mockStatus: status, mockBody: { error: { code: "temporarily_unavailable", message: "Try again shortly" } } }, { ok: true }]);
    try {
      const session = newSession("Design a wildlife register for rehabilitation staff.", { provider: "compatible", model: "mock", baseUrl: provider.url });
      assert.deepEqual(await callModel(session, "connection", z.object({ ok: z.boolean() }), {}, "synthetic-key"), { ok: true });
      assert.equal(provider.calls.length, 2);
    } finally { await provider.close(); }
  }
});

test("switching the workspace endpoint uses its matching key after a quota rejection", async () => {
  const first = await mockProvider([{ mockStatus: 403, mockBody: { error: { code: "insufficient_user_quota", message: "Insufficient quota" } } }]);
  const second = await mockProvider([{ ok: true }]);
  try {
    const session = newSession("Design a wildlife register for rehabilitation staff.", { provider: "compatible", model: "first", baseUrl: first.url });
    const keys = { [first.url]: "first-private-key", [second.url]: "second-private-key" };
    await assert.rejects(() => callModel(session, "connection", z.object({ ok: z.boolean() }), {}, keys), /insufficient_user_quota/);
    await transition(session, { action: "config", config: { provider: "compatible", model: "second", baseUrl: second.url }, agentConfigs: {} });
    await callModel(session, "connection", z.object({ ok: z.boolean() }), {}, keys);
    assert.equal(first.calls.length, 1);
    assert.equal(second.calls[0].authorization, "Bearer second-private-key");
    assert.equal(second.calls[0].body.model, "second");
    assert.ok(!JSON.stringify(session).includes("private-key"));
  } finally { await first.close(); await second.close(); }
});

test("model discovery preserves quota diagnostics without exposing credentials", async () => {
  const provider = await mockProvider([{ mockStatus: 403, mockBody: { error: { code: "insufficient_user_quota", message: "insufficient user quota synthetic-discovery-key" } } }]);
  try {
    await assert.rejects(() => listProviderModels({ provider: "compatible", baseUrl: provider.url, model: "" }, "synthetic-discovery-key"), error => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /insufficient_user_quota/);
      assert.ok(!error.message.includes("synthetic-discovery-key"));
      return true;
    });
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

test("temporary keys normalize pasted wrappers without crossing endpoint boundaries", () => {
  const config = presetConfig("openrouter");
  assert.equal(normalizeApiKey('  Bearer "synthetic-key"  '), "synthetic-key");
  assert.equal(providerSecret(config, { [credentialScope(config)]: "  synthetic-key\n" }), "synthetic-key");
  assert.equal(providerSecret(config, "Bearer synthetic-key"), "synthetic-key");
  assert.equal(normalizeApiKey("  "), "");
});


test("live interview autofill drafts grounded answers without advancing or overwriting user text", async () => {
  const provider = await mockProvider([{ answers: [{ id: "retention", answer: "Assumption for review: retain the minimum history needed for auditing; confirm the retention period." }] }]);
  try {
    const session = newSession("Design a wildlife rescue register for staff recording animals and care observations.", { provider: "compatible", baseUrl: provider.url, model: "mock" });
    session.stage = 2; session.completedStages = [1];
    session.interview.pending = [
      { id: "entities", category: "Entities & attributes", question: "Which animals and care observations do staff record?", hint: "Describe known data." },
      { id: "retention", category: "Security & privacy", question: "How long should care history be retained?", hint: "State a retention policy." },
    ];
    const before = structuredClone(session.interview);
    const existing = { entities: "Keep my exact answer about animals and staff.", stale: "Do not include obsolete question IDs." };
    const answers = await draftInterviewAnswers(session, existing, "temporary-autofill-secret");
    assert.equal(answers.entities, existing.entities);
    assert.match(answers.retention, /^Assumption for review:/);
    assert.equal(answers.stale, undefined);
    assert.deepEqual(session.interview, before); assert.equal(session.stage, 2);
    assert.equal(provider.calls[0].authorization, "Bearer temporary-autofill-secret");
    const payload = JSON.parse((provider.calls[0].body.messages as { content: string }[])[1].content).data;
    assert.equal(payload.phase, "autofill"); assert.equal(payload.questions.length, 1);
    assert.equal(payload.brief, session.description); assert.equal(payload.existingAnswers.entities, existing.entities);
    assert.ok(!JSON.stringify(session.logs).includes("temporary-autofill-secret"));
    await draftInterviewAnswers(session, answers, "temporary-autofill-secret");
    assert.equal(provider.calls.length, 1);
  } finally { await provider.close(); }
});

test("autofill rejects unrelated generated question IDs and preserves interview state", async () => {
  const invalid = { answers: [{ id: "unrelated", answer: "Assumption for review: use a conservative default." }] };
  const provider = await mockProvider([invalid, invalid, invalid]);
  try {
    const session = newSession("Design a small equipment lending register for trusted library staff.", { provider: "compatible", baseUrl: provider.url, model: "mock" });
    session.stage = 2; session.completedStages = [1];
    session.interview.pending = [{ id: "rules", category: "Business rules", question: "Which rules govern simultaneous item loans?", hint: "Describe loan limits." }];
    const before = structuredClone(session.interview);
    await assert.rejects(() => draftInterviewAnswers(session, {}, "synthetic-key"), /each unanswered question exactly once/);
    assert.deepEqual(session.interview, before); assert.equal(session.stage, 2);
  } finally { await provider.close(); }
});


function designSession(url: string) {
  const session = newSession("Design a coworking platform for members, spaces, bookings and billing.", { provider: "compatible", baseUrl: url, model: "mock-design" });
  session.stage = 4; session.completedStages = [1, 2, 3]; session.choice = structuredClone(demoChoice);
  return session;
}

test("stage 4 resumes a saved draft, builds tables in dependency waves, and completes the stage", async () => {
  const design = demoDesign();
  const ordered = orderedTables(design);
  const plan = { ...design, tables: ordered.map(table => ({ name: table.name, purpose: table.purpose, dependsOn: [...new Set(table.foreignKeys.map(key => key.refTable).filter(name => name !== table.name))] })) };
  const calls: Record<string, unknown>[] = [];
  const server: Server = createServer(async (request, response) => {
    let text = "";
    for await (const chunk of request) text += chunk;
    const body = JSON.parse(text);
    calls.push(body);
    const input = JSON.parse(body.messages[1].content).data;
    const table = design.tables.find(item => item.name === input.target.name);
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ model: "mock-design", choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ table }) } }] }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  try {
    const session = designSession(`http://127.0.0.1:${address.port}/v1`);
    session.interview.summary = "Members book rooms and staff manage bookings.";
    session.designDraft = { plan, tables: [] };
    await transition(session, { action: "design", apiKey: "synthetic-key" });
    const requested = calls.map(call => JSON.parse((call.messages as { content: string }[])[1].content).data.target.name);
    assert.equal(requested.length, design.tables.length);
    assert.deepEqual([...requested].sort(), design.tables.map(table => table.name).sort());
    assert.equal(session.design?.tables.length, design.tables.length);
    assert.equal(session.designDraft, undefined);
    assert.ok(session.completedStages.includes(4));
    assert.equal(session.stage, 5);
    for (const name of ["conceptual-model.md", "logical-schema.md", "normalization.md", "assumptions.md", "design.json"]) assert.ok(session.artifacts[name], name);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
