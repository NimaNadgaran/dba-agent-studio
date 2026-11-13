import { promises as fs } from "node:fs";
import path from "node:path";
import { demoAnswers, newSession, transition } from "../src/lib/workflow";
import { saveSession } from "../src/lib/store";

async function main() {
  const session = newSession("", { provider: "demo", model: "", baseUrl: "" });
  await transition(session, { action: "intake" });
  await transition(session, { action: "interview", answers: demoAnswers });
  await transition(session, { action: "interview", answers: demoAnswers });
  await transition(session, { action: "selection" });
  await transition(session, { action: "design" });
  await transition(session, { action: "revision", request: "Add an optional phone number to members" });
  await transition(session, { action: "approve" });
  await transition(session, { action: "sql" });
  if (session.validation?.status !== "passed") throw new Error(JSON.stringify(session.validation));
  await saveSession(session);
  const directory = path.join(process.cwd(), "examples", "lumina");
  await fs.mkdir(directory, { recursive: true });
  for (const item of Object.values(session.artifacts)) await fs.writeFile(path.join(directory, item.name), item.content, "utf8");
  await fs.writeFile(path.join(directory, "llm-calls.json"), JSON.stringify(session.logs, null, 2), "utf8");
  await fs.writeFile(path.join(directory, "session.json"), JSON.stringify(session, null, 2), "utf8");
  process.stdout.write(`Example complete: ${session.id}\nValidation: ${session.validation.engine} — ${session.validation.status}\nArtifacts: ${Object.keys(session.artifacts).length}\nOpen http://127.0.0.1:3000/?workspace=${session.id}\n`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
