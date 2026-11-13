import assert from "node:assert/strict";
import { test } from "node:test";
import { demoDesign } from "../src/lib/demo";
import { generateSQL, mermaidDiagram, orderedTables, sqlLiteral, sqlType, validateDesign } from "../src/lib/design";
import { designSchema, dbmsNames } from "../src/lib/types";
import { validateSQL } from "../src/lib/validation";

test("example satisfies canonical schema and integrity rules", () => {
  const design = designSchema.parse(demoDesign());
  assert.doesNotThrow(() => validateDesign(design));
  assert.equal(design.tables.length, 8);
  assert.ok(design.tables.every(table => table.rows.length >= 3));
});

test("compiler covers all four dialects with consistent tables and FK ordering", () => {
  const design = demoDesign();
  for (const dbms of dbmsNames) {
    const sql = generateSQL(design, dbms);
    assert.equal((sql.schema.match(/CREATE TABLE /g) || []).length, design.tables.length);
    assert.equal((sql.seed.match(/INSERT INTO /g) || []).length, design.tables.length);
    assert.ok(!sql.schema.includes("DROP DATABASE"));
    if (dbms === "SQL Server") { assert.ok(sql.schema.includes("DATETIME2")); assert.ok(sql.schema.includes("NVARCHAR")); assert.ok(!sql.schema.includes("ON DELETE RESTRICT")); }
    if (dbms === "SQLite") assert.ok(sql.schema.includes("PRAGMA foreign_keys = ON"));
    if (dbms === "MySQL") assert.ok(sql.schema.includes("ENGINE=InnoDB"));
  }
  const order = orderedTables(design).map(table => table.name);
  assert.ok(order.indexOf("members") < order.indexOf("bookings"));
  assert.ok(order.indexOf("amenities") < order.indexOf("space_amenities"));
});

test("real SQLite executes all constraints and every sample row", async () => {
  const result = await validateSQL(demoDesign(), "SQLite");
  assert.equal(result.status, "passed", JSON.stringify(result));
  assert.ok(result.checks.every(check => check.passed));
  assert.ok(result.checks.some(check => check.name === "Foreign key check"));
});

test("real PostgreSQL executes generated schema and seed", { timeout: 120000 }, async () => {
  const result = await validateSQL(demoDesign(), "PostgreSQL");
  assert.equal(result.status, "passed", JSON.stringify(result));
  assert.equal(result.checks.filter(check => check.name.startsWith("Rows:")).length, 8);
});

test("unavailable target engines never claim execution success", async () => {
  for (const dbms of ["MySQL", "SQL Server"] as const) {
    const result = await validateSQL(demoDesign(), dbms);
    assert.equal(result.status, "structural");
    assert.ok(!result.checks.some(check => check.name === "Execute schema.sql"));
  }
});

test("invalid FK parents, duplicate keys and unsafe checks are rejected", () => {
  const orphan = demoDesign(); orphan.tables.find(table => table.name === "bookings")!.rows[0].member_id = 999;
  assert.throws(() => validateDesign(orphan), /no parent/);
  const duplicate = demoDesign(); duplicate.tables[0].rows[1].email = duplicate.tables[0].rows[0].email;
  assert.throws(() => validateDesign(duplicate), /Duplicate seed key/);
  const unsafe = demoDesign(); unsafe.tables[0].checks.push({ name: "unsafe_check", expression: "1=1); DROP TABLE members; --" });
  assert.throws(() => validateDesign(unsafe), /Unsafe check/);
  const functionCall = demoDesign(); functionCall.tables[0].checks.push({ name: "external_check", expression: "dblink_connect('remote') = 1" });
  assert.throws(() => validateDesign(functionCall), /Unsupported CHECK function/);
});

test("null cannot be replaced by a default during structural validation", () => {
  const design = demoDesign(); design.tables[0].columns[1].default = "Fallback"; design.tables[0].rows[0].full_name = null;
  assert.throws(() => validateDesign(design), /missing members.full_name/);
});

test("literals safely preserve apostrophes, Unicode and backslashes", () => {
  assert.equal(sqlLiteral("O'Brien", "PostgreSQL"), "'O''Brien'");
  assert.equal(sqlLiteral("تهران", "SQL Server"), "N'تهران'");
  assert.ok(sqlLiteral("C:\\'a", "MySQL").startsWith("CONVERT(X'"));
  assert.equal(sqlLiteral(false, "PostgreSQL"), "FALSE");
  assert.equal(sqlLiteral(null, "SQLite"), "NULL");
  assert.throws(() => sqlLiteral(Number.NaN, "SQLite"));
});

test("Mermaid contains all canonical tables and relations", () => {
  const design = demoDesign(); const source = mermaidDiagram(design);
  assert.ok(source.startsWith("erDiagram"));
  for (const table of design.tables) { assert.ok(source.includes(`${table.name} {`)); for (const key of table.foreignKeys) { const optional = key.columns.some(name => table.columns.find(column => column.name === name)?.nullable); assert.ok(source.includes(`${key.refTable} ${optional ? "|o" : "||"}--o{ ${table.name}`)); } }
  assert.equal(sqlType({ name: "amount", type: "decimal", nullable: false, description: "Amount" }, "PostgreSQL"), "DECIMAL(12,2)");
});

test("real execution catches violated business CHECK constraints", async () => {
  const design = demoDesign(); design.tables.find(table => table.name === "spaces")!.rows[0].capacity = -1;
  const result = await validateSQL(design, "SQLite");
  assert.equal(result.status, "failed"); assert.match(result.error || "", /CHECK constraint failed/);
});
