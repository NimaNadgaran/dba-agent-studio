import { createRequire } from "node:module";
import path from "node:path";
import { promises as fs } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import initSqlJs from "sql.js";
import { generateSQL, quoteIdentifier, validateDesign } from "./design";
import type { DBMS, Design, Validation } from "./types";

export async function validateSQL(design: Design, dbms: DBMS): Promise<Validation> {
  const started = Date.now();
  const checks: Validation["checks"] = [];
  try {
    validateDesign(design);
    checks.push({ name: "Canonical integrity", passed: true, detail: "Unique keys, column types, FK targets, nullability and sample references checked." });
    const sql = generateSQL(design, dbms);
    if (dbms === "PostgreSQL") {
      const database = new PGlite();
      try {
        await database.exec(sql.schema);
        checks.push({ name: "Execute schema.sql", passed: true, detail: "Executed in isolated PostgreSQL (PGlite)." });
        await database.exec(sql.seed);
        checks.push({ name: "Execute seed.sql", passed: true, detail: "All constraints and FK checks active." });
        for (const table of design.tables) {
          const result = await database.query<{ count: number }>(`SELECT COUNT(*)::integer AS count FROM ${quoteIdentifier(table.name, dbms)}`);
          const count = result.rows[0].count;
          checks.push({ name: `Rows: ${table.name}`, passed: count === table.rows.length, detail: `${count} meaningful sample rows; expected ${table.rows.length}.` });
        }
      } finally { await database.close(); }
    } else if (dbms === "SQLite") {
      const require = createRequire(path.join(process.cwd(), "package.json"));
      const wasm = await fs.readFile(require.resolve("sql.js/dist/sql-wasm.wasm"));
      const SQL = await initSqlJs({ wasmBinary: new Uint8Array(wasm).buffer });
      const database = new SQL.Database();
      try {
        database.run("PRAGMA foreign_keys = ON;");
        database.exec(sql.schema);
        checks.push({ name: "Execute schema.sql", passed: true, detail: "Executed in isolated SQLite (sql.js), foreign keys enabled." });
        database.exec(sql.seed);
        checks.push({ name: "Execute seed.sql", passed: true, detail: "Real SQLite CHECK, UNIQUE, NOT NULL and FK constraints active." });
        const violations = database.exec("PRAGMA foreign_key_check;");
        checks.push({ name: "Foreign key check", passed: violations.length === 0, detail: violations.length ? "Foreign-key violations found." : "No foreign-key violations." });
        const integrity = database.exec("PRAGMA integrity_check;");
        checks.push({ name: "SQLite integrity", passed: integrity[0]?.values[0]?.[0] === "ok", detail: String(integrity[0]?.values[0]?.[0]) });
        for (const table of design.tables) {
          const count = Number(database.exec(`SELECT COUNT(*) FROM ${quoteIdentifier(table.name, dbms)}`)[0]?.values[0]?.[0]);
          checks.push({ name: `Rows: ${table.name}`, passed: count === table.rows.length, detail: `${count} sample rows; expected ${table.rows.length}.` });
        }
      } finally { database.close(); }
    } else {
      checks.push({ name: "Dialect compilation", passed: true, detail: `${dbms} identifiers, types, literals, constraints and dependency order compiled. No target-engine execution occurred.` });
      return { engine: `${dbms} · structural checks only`, status: "structural", attempts: 1, durationMs: Date.now() - started, checks };
    }
    return { engine: dbms === "PostgreSQL" ? "PostgreSQL · PGlite" : "SQLite · sql.js", status: checks.every(check => check.passed) ? "passed" : "failed", attempts: 1, durationMs: Date.now() - started, checks };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({ name: "Execution / integrity", passed: false, detail: message });
    return { engine: dbms, status: "failed", attempts: 1, durationMs: Date.now() - started, checks, error: message };
  }
}
