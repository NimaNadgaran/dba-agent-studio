import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError, type CallLog, type Session, type SessionSummary } from "./types";
import { designTextOutputs } from "./design-documents";

const queues = new Map<string, Promise<unknown>>();
const remote = () => Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const dataRoot = () => path.resolve(process.env.DATA_DIR || (process.env.VERCEL ? "/tmp/dba-agent/data" : "data"));
const outputRoot = () => path.resolve(process.env.OUTPUT_DIR || (process.env.VERCEL ? "/tmp/dba-agent/outputs" : "outputs"));
export const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

async function redis(command: unknown[]): Promise<unknown> {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL!, { method: "POST", headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(command), signal: AbortSignal.timeout(20000), cache: "no-store" });
  if (!response.ok) throw new AppError("Remote persistence is unavailable. Your local request was not saved.", 503);
  const body = await response.json();
  if (body.error) throw new AppError(`Remote storage failed: ${body.error}`, 503);
  return body.result;
}

export async function readSession(id: string): Promise<Session> {
  if (!validId(id)) throw new AppError("Invalid workspace ID.");
  try {
    const value = remote() ? await redis(["GET", `dba:session:${id}`]) : await fs.readFile(path.join(dataRoot(), `${id}.json`), "utf8");
    if (!value) throw new AppError("Workspace not found.", 404);
    const session = JSON.parse(String(value)) as Session;
    for (const document of designTextOutputs(session)) {
      const artifact = session.artifacts[document.name];
      if (artifact) artifact.content = document.content;
    }
    return session;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new AppError("Workspace not found.", 404);
    throw error;
  }
}

function summarize(session: Session): SessionSummary {
  return { id: session.id, title: session.title, description: session.description, createdAt: session.createdAt, updatedAt: session.updatedAt, version: session.version, stage: session.stage, completedStages: session.completedStages, mode: session.mode, designVersion: session.designVersion, approvedAt: session.approvedAt, tables: session.design?.tables.length ?? 0, artifacts: Object.keys(session.artifacts).length, dbms: session.choice?.selected };
}

export async function listSessions(): Promise<SessionSummary[]> {
  let ids: string[];
  if (remote()) ids = await redis(["SMEMBERS", "dba:sessions"]) as string[];
  else {
    await fs.mkdir(dataRoot(), { recursive: true });
    ids = (await fs.readdir(dataRoot())).filter(name => name.endsWith(".json")).map(name => name.slice(0, -5)).filter(validId);
  }
  const sessions = await Promise.all(ids.map(id => readSession(id)));
  return sessions.map(summarize).sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

export async function saveSession(session: Session): Promise<void> {
  if (!validId(session.id)) throw new AppError("Invalid workspace ID.");
  session.updatedAt = new Date().toISOString();
  session.version += 1;
  if (remote()) {
    const summary = JSON.stringify(session);
    await redis(["EVAL", "redis.call('SET', KEYS[1], ARGV[1]); redis.call('SADD', KEYS[2], ARGV[2]); return 1", 2, `dba:session:${session.id}`, "dba:sessions", summary, session.id]);
    return;
  }
  await fs.mkdir(dataRoot(), { recursive: true });
  const target = path.join(dataRoot(), `${session.id}.json`);
  const temporary = `${target}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(session, null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, target);
  const output = path.join(outputRoot(), session.id);
  await fs.mkdir(output, { recursive: true });
  const expectedFiles = new Set([...Object.keys(session.artifacts), "llm-calls.json", "session.json"]);
  for (const name of await fs.readdir(output)) if (!expectedFiles.has(name) && /^[a-z][a-z0-9_.-]+$/.test(name)) await fs.unlink(path.join(output, name));
  for (const item of Object.values(session.artifacts)) {
    if (!/^[a-z][a-z0-9_.-]+$/.test(item.name)) throw new AppError("Invalid artifact filename.");
    await fs.writeFile(path.join(output, item.name), item.content, "utf8");
  }
  await fs.writeFile(path.join(output, "llm-calls.json"), JSON.stringify(session.logs, null, 2), "utf8");
  await fs.writeFile(path.join(output, "session.json"), JSON.stringify(session, null, 2), "utf8");
}

export async function saveProviderCheck(logs: CallLog[]): Promise<string> {
  const id = randomUUID();
  const record = JSON.stringify({ id, at: new Date().toISOString(), logs }, null, 2);
  if (remote()) await redis(["SET", `dba:provider-check:${id}`, record, "EX", 2592000]);
  else {
    const directory = path.join(dataRoot(), "provider-checks");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, `${id}.json`), record, { encoding: "utf8", mode: 0o600 });
  }
  return id;
}

export async function withSessionLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
  const previous = queues.get(id) ?? Promise.resolve();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  queues.set(id, pending);
  await previous.catch(() => undefined);
  let token: string | undefined;
  try {
    if (remote()) {
      token = randomUUID();
      const acquired = await redis(["SET", `dba:lock:${id}`, token, "NX", "PX", 600000]);
      if (!acquired) throw new AppError("This workspace is busy in another request. Please retry shortly.", 409);
    }
    return await operation();
  } finally {
    if (token) await redis(["EVAL", "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, `dba:lock:${id}`, token]).catch(() => undefined);
    release();
    if (queues.get(id) === pending) queues.delete(id);
  }
}

export function storageStatus() {
  return { mode: remote() ? "redis" : "filesystem", durable: remote() || !process.env.VERCEL, outputDirectory: remote() ? "Remote storage · download ZIP for files" : "outputs/<workspace-id>/" };
}
