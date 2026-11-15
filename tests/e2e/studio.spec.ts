import { test, expect } from "@playwright/test";
import JSZip from "jszip";
import { promises as fs } from "node:fs";
import { demoAnswers, demoChoice, demoDesign } from "../../src/lib/demo";
import { createServer } from "node:http";
import { categories } from "../../src/lib/types";

test("desktop guided example completes all six stages, renders diagrams and exports valid artifacts", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Good ideas deserve/ })).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/01-overview-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Explore an example", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lumina coworking.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Understand my system" }).click();
  await expect(page.getByRole("heading", { name: "Here’s what we understood" })).toBeVisible();
  await page.getByRole("button", { name: "intake.md", exact: false }).first().click();
  await expect(page.getByRole("dialog", { name: "intake.md" })).toBeVisible();
  await expect(page.locator(".preview-content")).toContainText("Main processes");
  await page.getByRole("button", { name: "Close artifact" }).click();
  await page.getByRole("button", { name: "Continue to the interview" }).click();
  await page.getByRole("button", { name: "Fill example answers" }).click();
  await expect(page.locator(".question textarea")).toHaveCount(7);
  await page.getByRole("button", { name: "Review my answers" }).click();
  await expect(page.locator(".question textarea")).toHaveCount(2);
  await expect(page.locator(".interview-round")).toContainText("Round 2");
  await page.getByRole("button", { name: "Fill example answers" }).click();
  await page.getByRole("button", { name: "Review follow-up answers" }).click();
  await expect(page.locator(".stage-heading h2")).toHaveText("DBMS selection");
  await expect(page.getByRole("button", { name: "Compare & select a DBMS" })).toBeVisible();
  await page.getByRole("button", { name: "Compare & select a DBMS" }).click();
  await expect(page.locator(".selected-engine")).toContainText("PostgreSQL");
  await page.getByRole("button", { name: "Build the design", exact: true }).click();
  await page.getByRole("button", { name: "Generate a complete design" }).click();
  await expect(page.locator(".table-inventory>div")).toHaveCount(8);
  await page.getByRole("button", { name: "Relationship map", exact: true }).click();
  await expect(page.locator(".diagram-view svg")).toBeVisible();
  await expect(page.locator(".diagram-view")).not.toContainText("could not render");
  await page.screenshot({ path: "test-results/screenshots/02-relationship-map.png", fullPage: true });
  await page.locator(".stage-stepper button").nth(4).click();
  await page.getByRole("button", { name: "Add an optional phone number to members", exact: false }).click();
  await page.getByRole("button", { name: "Apply revision", exact: true }).click();
  await expect(page.locator(".version-badge").first()).toHaveText("v2");
  await page.getByRole("button", { name: "Switch to SQLite", exact: true }).click();
  await page.getByRole("button", { name: "Apply revision", exact: true }).click();
  await expect(page.locator(".version-badge").first()).toHaveText("v3");
  await page.getByRole("button", { name: "Approve this design" }).click();
  await page.getByRole("button", { name: "Continue to SQL" }).click();
  await page.getByRole("button", { name: "Generate & validate SQL" }).click();
  await expect(page.getByText("Executed. Checked. Ready.", { exact: true })).toBeVisible();
  await expect(page.locator(".validation-result")).toContainText("SQLite · sql.js");
  await page.screenshot({ path: "test-results/screenshots/03-sql-validation.png", fullPage: true });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download complete bundle" }).click();
  const download = await downloadPromise;
  const zip = await JSZip.loadAsync(await fs.readFile((await download.path())!));
  for (const name of ["intake.md", "requirements.md", "dbms-choice.md", "conceptual-model.md", "logical-schema.md", "normalization.md", "assumptions.md", "changelog.md", "schema.sql", "seed.sql", "validation.md", "design.json", "llm-calls.json", "session.json"]) expect(zip.file(name), name).toBeTruthy();
  expect(await zip.file("schema.sql")!.async("string")).toContain('"phone"');
  expect(await zip.file("requirements.md")!.async("string")).toContain("Interview round 2");
  const workspaceUrl = page.url();
  await page.reload();
  await expect(page.getByText("Executed. Checked. Ready.", { exact: true })).toBeVisible();
  expect(page.url()).toBe(workspaceUrl);
  await page.getByRole("button", { name: "Activity & traces", exact: true }).click();
  await expect(page.locator(".trace-row").first()).toBeVisible();
  await page.locator(".trace-row").first().click();
  await expect(page.locator(".trace-detail")).toBeVisible();
  await page.getByRole("button", { name: "Prompt library", exact: true }).click();
  await expect(page.getByRole("button", { name: "design-contract.md" })).toBeVisible();
  await page.getByRole("button", { name: "design-contract.md" }).click();
  await expect(page.locator(".prompt-content")).toContainText("Canonical design JSON contract");
  await page.getByRole("button", { name: "Settings & providers", exact: true }).click();
  await expect(page.getByLabel("Provider", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile dashboard and workspace remain usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Good ideas deserve/ })).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/04-overview-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("button", { name: "Settings & providers", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Design workspaces", exact: false }).click();
  await expect(page.getByRole("heading", { name: /A home for your next big idea/ })).toBeVisible();
  await page.locator(".project-row").first().click();
  await expect(page.locator(".stage-stepper")).toBeVisible();
  await page.locator(".stage-stepper button").first().click();
  await expect(page.locator(".brief-box")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: "test-results/screenshots/05-workspace-mobile.png", fullPage: true });
});

test("API enforces ordering, optimistic concurrency, origin boundaries and export provenance", async ({ request }) => {
  const created = await request.post("/api/sessions", { data: { config: { provider: "demo", model: "", baseUrl: "" } } });
  expect(created.status()).toBe(201);
  const { session } = await created.json();
  const endpoint = `/api/sessions/${session.id}`;
  const skipped = await request.post(endpoint, { data: { action: "sql", version: session.version } });
  expect(skipped.status()).toBe(409);
  const latest = (await (await request.get(endpoint)).json()).session;
  const stale = await request.post(endpoint, { data: { action: "intake", version: session.version } });
  expect(stale.status()).toBe(409);
  const valid = await request.post(endpoint, { data: { action: "intake", version: latest.version } });
  expect(valid.status()).toBe(200);
  const crossOrigin = await request.post(endpoint, { headers: { origin: "https://evil.example.org" }, data: { action: "intake", version: 999 } });
  expect(crossOrigin.status()).toBe(403);
  const wrongType = await request.post(endpoint, { headers: { "content-type": "text/plain" }, data: "{}" });
  expect(wrongType.status()).toBe(415);
  const invalid = await request.get("/api/sessions/not-a-valid-id"); expect(invalid.status()).toBe(400);
  const exported = await request.get(`${endpoint}/export`); expect(exported.status()).toBe(200);
  const zip = await JSZip.loadAsync(await exported.body());
  expect(await zip.file("EXPORT-README.md")!.async("string")).toContain("Offline illustrative fixture");
});

test("production API executes PostgreSQL and honestly reports MySQL and SQL Server boundaries", async ({ request }) => {
  let session = (await (await request.post("/api/sessions", { data: { config: { provider: "demo", model: "", baseUrl: "" } } })).json()).session;
  const answers = demoAnswers;
  const act = async (action: string, extra = {}) => {
    const response = await request.post(`/api/sessions/${session.id}`, { data: { action, version: session.version, ...extra } });
    expect(response.status()).toBe(200); session = (await response.json()).session;
  };
  await act("intake"); await act("interview", { answers }); await act("interview", { answers }); await act("selection"); await act("design"); await act("approve"); await act("sql");
  expect(session.validation.status).toBe("passed"); expect(session.validation.engine).toContain("PostgreSQL");
  for (const dbms of ["MySQL", "SQL Server"]) {
    await act("revision", { request: `Switch to ${dbms}` });
    expect(session.approvedAt).toBeUndefined(); expect(session.artifacts["schema.sql"]).toBeUndefined();
    await act("approve"); await act("sql");
    expect(session.validation.status).toBe("structural");
    expect(session.artifacts["logical-schema.md"].content).toContain(dbms);
    expect(session.artifacts["schema.sql"].content).toContain(`Target: ${dbms}`);
  }
});

test("live provider picker discovers models, tests JSON, uses shared workspace configuration and never persists keys", async ({ page, request }) => {
  const calls: { model?: string; authorization?: string }[] = [];
  const server = createServer(async (incoming, outgoing) => {
    outgoing.setHeader("content-type", "application/json");
    if (incoming.method === "GET") { outgoing.end(JSON.stringify({ data: [{ id: "mock-intake" }, { id: "mock-interview" }] })); return; }
    let text = ""; for await (const chunk of incoming) text += chunk;
    const body = JSON.parse(text);
    calls.push({ model: body.model, authorization: incoming.headers.authorization });
    const input = JSON.parse(body.messages[1].content).data;
    const result = body.messages[0].content.includes("# Provider connection check") ? { ok: true } : input.choice ? demoDesign() : input.interview?.ready && !input.phase ? demoChoice : input.phase === "autofill" ? {
      answers: input.questions.map((question: { id: string }) => ({ id: question.id, answer: "Assumption for review: use conservative staff-only access, preserve referenced records, and confirm any unknown business limits." })),
    } : input.phase === "evaluate" ? input.rounds.length >= 2 ? {
      ready: true, questions: [], rationale: "The initial requirements and targeted follow-up have been reviewed.", summary: "Staff record rescued animals and care observations. Use mandatory identifiers and foreign keys, restrict deletion of referenced history, use staff-only access, and document conservative assumptions for unconfirmed volume and retention.",
    } : {
      ready: false, rationale: "Confirm whether animal care history must be retained when staff leave the centre.", summary: "Staff record animals and observations.", questions: [{ id: "retention_followup", category: "Business rules", question: "Should care history remain when a staff member leaves?", hint: "Confirm retention and deletion behaviour." }],
    } : !input.phase ? {
      title: "Wildlife register", summary: "An independent wildlife centre records rescued animals and their care observations.", actors: ["Care staff"], entities: ["Animals", "Care observations"], processes: ["Admit an animal"], risks: ["Confirm retention rules"],
    } : { ready: false, rationale: "Clarify all seven categories before designing the wildlife register.", summary: "", questions: categories.map((category, index) => ({ id: `question_${index}`, category, question: `What does this wildlife centre need for ${category}?`, hint: "Describe the animal care process." })) };
    outgoing.end(JSON.stringify({ model: body.model, choices: [{ finish_reason: "stop", message: { content: JSON.stringify(result) } }] }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No mock server address");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const secret = "synthetic-browser-test-key";
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings & providers", exact: true }).click();
    const defaults = page.locator(".settings-form .provider-picker");
    await defaults.getByLabel("Provider", { exact: true }).selectOption("groq");
    await expect(defaults.getByLabel("API base URL", { exact: true })).toHaveValue("https://api.groq.com/openai/v1");
    await expect(defaults.getByRole("link", { name: /Get your own/ })).toHaveAttribute("href", "https://console.groq.com/keys");
    await defaults.getByLabel("Provider", { exact: true }).selectOption("kilo");
    await expect(defaults.getByLabel("Model identifier", { exact: true })).toHaveValue("kilo-auto/free");
    await defaults.getByLabel("Provider", { exact: true }).selectOption("custom");
    await defaults.getByLabel("API base URL", { exact: true }).fill(baseUrl);
    await defaults.getByLabel("Temporary API key", { exact: false }).fill(`  Bearer "${secret}"  `);
    await expect(defaults.getByText("Using the temporary key", { exact: false })).toBeVisible();
    await defaults.getByRole("button", { name: "Clear temporary key", exact: true }).click();
    await expect(defaults.getByLabel("Temporary API key", { exact: false })).toHaveValue("");
    await defaults.getByLabel("Temporary API key", { exact: false }).fill(secret);
    await defaults.getByRole("button", { name: "Load models", exact: true }).click();
    await defaults.getByLabel("Available models", { exact: true }).selectOption("mock-intake");
    await defaults.getByRole("button", { name: "Test connection", exact: true }).click();
    await expect(defaults.getByRole("status")).toContainText("Connection and JSON response verified");
    await expect(page.getByRole("heading", { name: "Provider & model per stage" })).toHaveCount(0);
    await page.getByRole("button", { name: "Save configuration", exact: true }).click();
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page.getByRole("button", { name: "New design", exact: true }).click();
    await page.getByLabel("Tell us about your system", { exact: true }).fill("Design an independent wildlife register with rescued animals and care records for rehabilitation staff.");
    await page.getByRole("button", { name: "Create design workspace", exact: true }).click();
    await expect(page).toHaveURL(/\?workspace=/);
    const workspaceId = new URL(page.url()).searchParams.get("workspace")!;
    const existing = (await (await request.get(`/api/sessions/${workspaceId}`)).json()).session;
    const legacy = await request.post(`/api/sessions/${workspaceId}`, { data: { action: "config", version: existing.version, agentConfigs: { interview: { provider: "compatible", baseUrl: "https://unused-provider.example.org/v1", model: "legacy-model" } } } });
    expect(legacy.ok()).toBeTruthy();
    await page.reload();
    const workspacePicker = page.locator(".stage-aside .provider-picker");
    await workspacePicker.getByLabel("Temporary API key", { exact: false }).fill(`  Bearer "${secret}"  `);
    await workspacePicker.getByLabel("Model identifier", { exact: true }).fill("mock-interview");
    await page.getByRole("button", { name: "Understand my system", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Here’s what we understood", exact: true })).toBeVisible();
    expect(calls.slice(-2).map(call => call.model)).toEqual(["mock-interview", "mock-interview"]);
    expect(calls.every(call => call.authorization === `Bearer ${secret}`)).toBeTruthy();
    const id = new URL(page.url()).searchParams.get("workspace")!;
    const saved = (await (await request.get(`/api/sessions/${id}`)).json()).session;
    expect(saved.agentConfigs).toEqual({});
    expect(saved.config.model).toBe("mock-interview");
    await expect(page.locator(".stage-aside > section").first()).toHaveClass(/output-panel/);
    await expect(page.locator(".stage-aside").getByRole("heading", { name: "Agent configuration" })).toBeVisible();
    expect(JSON.stringify(saved)).not.toContain(secret);
    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(secret);
    expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain(secret);
    await page.getByRole("button", { name: "Continue to the interview", exact: true }).click();
    await expect(page.locator(".question textarea")).toHaveCount(7);
    const manualAnswer = "Care staff record animals, admissions, and observations. Preserve this answer.";
    await page.locator(".question textarea").first().fill(manualAnswer);
    await expect(page.locator(".stage-heading-actions .chip")).toHaveText("In progress");
    await page.getByRole("button", { name: "Fill automatically", exact: true }).click();
    await expect(page.locator(".question textarea").nth(1)).toHaveValue(/Assumption for review/);
    await expect(page.locator(".question textarea").first()).toHaveValue(manualAnswer);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    const statusBox = await page.locator(".stage-heading-actions .chip").boundingBox();
    const fillBox = await page.getByRole("button", { name: "Fill automatically", exact: true }).boundingBox();
    expect(fillBox!.y).toBeGreaterThanOrEqual(statusBox!.y + statusBox!.height);
    await page.screenshot({ path: "test-results/screenshots/07-interview-autofill-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1080 });
    const failInterview = async (route: import("@playwright/test").Route) => {
      if (route.request().method() === "POST" && route.request().postDataJSON().action === "interview") {
        await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Synthetic temporary provider failure" }) });
        await page.unroute(`**/api/sessions/${id}`, failInterview);
      } else await route.continue();
    };
    await page.route(`**/api/sessions/${id}`, failInterview);
    await page.getByRole("button", { name: "Review my answers", exact: true }).click();
    await expect(page.locator(".stage-panel [role=alert]")).toContainText("Your answers are kept");
    await expect(page.locator(".question textarea").first()).toHaveValue(manualAnswer);
    await page.getByRole("button", { name: "Review my answers", exact: true }).click();
    await expect(page.locator(".question textarea")).toHaveCount(1);
    await expect(page.locator(".stage-panel")).toContainText("More detail is needed before stage 3");
    await page.getByRole("button", { name: "Fill automatically", exact: true }).click();
    await expect(page.locator(".question textarea")).toHaveValue(/Assumption for review/);
    await page.screenshot({ path: "test-results/screenshots/06-live-agent-picker.png", fullPage: true });
    await page.getByRole("button", { name: "Review follow-up answers", exact: true }).click();
    await expect(page.locator(".stage-heading h2")).toHaveText("DBMS selection");
    const completed = (await (await request.get(`/api/sessions/${id}`)).json()).session;
    expect(completed.interview.rounds).toHaveLength(2); expect(completed.stage).toBe(3);
    expect(JSON.stringify(completed)).not.toContain(secret);
    await page.getByRole("button", { name: "Compare & select a DBMS", exact: true }).click();
    await page.getByRole("button", { name: "Build the design", exact: true }).click();
    const failDesign = async (route: import("@playwright/test").Route) => {
      if (route.request().method() === "POST" && route.request().postDataJSON().action === "design") {
        await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Synthetic design generation failure" }) });
        await page.unroute(`**/api/sessions/${id}`, failDesign);
      } else await route.continue();
    };
    await page.route(`**/api/sessions/${id}`, failDesign);
    await page.getByRole("button", { name: "Generate a complete design", exact: true }).click();
    await expect(page.locator(".stage-panel [role=alert]")).toContainText("Your saved requirements are unchanged");
    await page.getByRole("button", { name: "Generate a complete design", exact: true }).click();
    await expect(page.locator(".table-inventory>div")).toHaveCount(8);
    await expect(page.locator(".stage-panel [role=alert]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Review & refine the design", exact: true })).toBeVisible();
    const designed = (await (await request.get(`/api/sessions/${id}`)).json()).session;
    expect(designed.completedStages).toContain(4); expect(designed.stage).toBe(5);
    for (const name of ["conceptual-model.md", "logical-schema.md", "normalization.md", "assumptions.md"]) expect(designed.artifacts[name]).toBeTruthy();
    await page.reload();
    await expect(page.locator(".stage-aside").getByLabel("Model identifier", { exact: true })).toHaveValue("mock-interview");
    await expect(page.locator(".stage-aside").getByLabel("Temporary API key", { exact: false })).toHaveValue("");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  } finally { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); }
});

test("provider API rejects unsupported actions and missing keys without claiming a connection", async ({ request }) => {
  const config = { provider: "compatible", baseUrl: "https://requires-key.example.org/v1", model: "synthetic-test-model" };
  const missingKey = await request.post("/api/providers", { data: { action: "test", config } });
  expect(missingKey.status()).toBe(400);
  expect((await missingKey.json()).error).toContain("LLM_API_KEY");
  const invalid = await request.post("/api/providers", { data: { action: "delete", config } });
  expect(invalid.status()).toBe(400);
  const origin = await request.post("/api/providers", { headers: { origin: "https://evil.example.org" }, data: { action: "models", config } });
  expect(origin.status()).toBe(403);
});


test("notifications persist, keep only the latest three, and dismiss individually", async ({ page }) => {
  let failures = 0;
  await page.route("**/api/sessions", async route => {
    if (route.request().method() === "POST") {
      failures += 1;
      await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: `Synthetic notification ${failures}` }) });
    } else await route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Good ideas deserve/ })).toBeVisible();
  await page.clock.install();
  await page.getByRole("button", { name: "New design", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Explore an example", exact: true }).click();
  for (let message = 1; message <= 4; message++) {
    await page.getByRole("button", { name: "Open the guided example", exact: true }).click();
    await expect(page.locator(".toast-stack .toast").last()).toContainText(`Synthetic notification ${message}`);
  }
  await page.getByRole("button", { name: "Close new workspace", exact: true }).click();
  const messages = page.locator(".toast-stack .toast");
  await expect(messages).toHaveCount(3);
  await expect(messages.nth(0)).toContainText("Synthetic notification 2");
  await expect(messages.nth(1)).toContainText("Synthetic notification 3");
  await expect(messages.nth(2)).toContainText("Synthetic notification 4");
  await page.clock.fastForward(15000);
  await expect(messages).toHaveCount(3);
  await messages.nth(1).getByRole("button", { name: "Dismiss message", exact: true }).click();
  await expect(messages).toHaveCount(2);
  await expect(messages.nth(0)).toContainText("Synthetic notification 2");
  await expect(messages.nth(1)).toContainText("Synthetic notification 4");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await messages.first().getByRole("button", { name: "Dismiss message", exact: true }).click();
  await messages.first().getByRole("button", { name: "Dismiss message", exact: true }).click();
  await expect(page.locator(".toast-stack")).toHaveCount(0);
});
