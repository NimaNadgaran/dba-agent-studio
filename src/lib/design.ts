import { AppError, type Column, type DBMS, type Design, type Scalar, type Table } from "./types";

export function quoteIdentifier(name: string, dbms: DBMS): string {
  if (!/^[a-z][a-z0-9_]{0,47}$/.test(name)) throw new AppError(`Invalid SQL identifier: ${name}`);
  return dbms === "MySQL" ? `\`${name}\`` : dbms === "SQL Server" ? `[${name}]` : `"${name}"`;
}

export function sqlType(column: Column, dbms: DBMS): string {
  const stringLength = column.length ?? 255;
  const types: Record<Column["type"], string> = {
    integer: "INTEGER", bigint: "BIGINT", string: `${dbms === "SQL Server" ? "NVARCHAR" : "VARCHAR"}(${stringLength})`,
    text: dbms === "SQL Server" ? "NVARCHAR(MAX)" : "TEXT",
    decimal: `DECIMAL(${column.precision ?? 12},${column.scale ?? 2})`,
    boolean: dbms === "PostgreSQL" ? "BOOLEAN" : dbms === "SQL Server" ? "BIT" : "INTEGER",
    date: "DATE", timestamp: dbms === "SQL Server" ? "DATETIME2" : dbms === "MySQL" ? "DATETIME" : "TIMESTAMP",
    uuid: dbms === "PostgreSQL" ? "UUID" : dbms === "SQL Server" ? "UNIQUEIDENTIFIER" : "VARCHAR(36)",
    json: dbms === "PostgreSQL" ? "JSONB" : dbms === "MySQL" ? "JSON" : dbms === "SQL Server" ? "NVARCHAR(MAX)" : "TEXT",
  };
  return types[column.type];
}

export function sqlLiteral(value: Scalar, dbms: DBMS): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return dbms === "PostgreSQL" ? (value ? "TRUE" : "FALSE") : (value ? "1" : "0");
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new AppError("SQL numeric values must be finite.");
    return String(value);
  }
  const escaped = value.replaceAll("'", "''");
  if (dbms === "MySQL") return `CONVERT(X'${Buffer.from(value, "utf8").toString("hex")}' USING utf8mb4)`;
  return `${dbms === "SQL Server" ? "N" : ""}'${escaped}'`;
}

export function orderedTables(design: Design): Table[] {
  const pending = new Map(design.tables.map(table => [table.name, table]));
  const ordered: Table[] = [];
  while (pending.size) {
    const next = [...pending.values()].find(table => table.foreignKeys.every(key => key.refTable === table.name || !pending.has(key.refTable)));
    if (!next) throw new AppError("Cyclic foreign keys require a deliberate migration strategy. Remove the cycle or use an associative table.");
    ordered.push(next);
    pending.delete(next.name);
  }
  return ordered;
}

function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new AppError(`Duplicate ${label}.`);
}

export function automaticIndexes(table: Table): Table["indexes"] {
  const checksum = Array.from(table.name).reduce((total, character) => Math.imul(total ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261).toString(36);
  return table.foreignKeys.flatMap((key, position) => {
    const covered = [table.primaryKey, ...table.unique, ...table.indexes.map(index => index.columns)].some(names => key.columns.every((name, index) => names[index] === name));
    return covered ? [] : [{ name: `fk_${table.name.slice(0, 30)}_${position}_${checksum}`, columns: key.columns, unique: false }];
  });
}

export function relationshipIsUnique(table: Table, columns: string[]): boolean {
  return [table.primaryKey, ...table.unique, ...table.indexes.filter(index => index.unique).map(index => index.columns)].some(key => key.every(name => columns.includes(name)));
}

export function columnDomainChecks(table: Table, dbms: DBMS): string[] {
  return table.columns.flatMap(column => {
    const identifier = quoteIdentifier(column.name, dbms);
    if (column.type === "boolean" && dbms !== "PostgreSQL") return [`${identifier} IN (0, 1)`];
    if (column.type === "string" && dbms === "SQLite") return [`length(${identifier}) <= ${column.length ?? 255}`];
    return [];
  });
}

export function validateDesign(design: Design): void {
  unique(design.tables.map(table => table.name), "table names");
  unique(design.tables.flatMap(table => [...table.indexes, ...automaticIndexes(table)].map(index => index.name)), "index names");
  unique(design.tables.flatMap(table => table.checks.map(check => check.name)), "constraint names across tables");
  for (const table of design.tables) {
    unique(table.columns.map(column => column.name), `column in ${table.name}`);
    const columns = new Map(table.columns.map(column => [column.name, column]));
    const checkColumns = (names: string[]) => {
      unique(names, `key columns in ${table.name}`);
      for (const name of names) if (!columns.has(name)) throw new AppError(`Unknown column ${table.name}.${name}.`);
    };
    checkColumns(table.primaryKey);
    for (const name of table.primaryKey) if (columns.get(name)!.nullable) throw new AppError(`Primary key ${table.name}.${name} cannot be nullable.`);
    for (const names of table.unique) checkColumns(names);
    for (const index of table.indexes) checkColumns(index.columns);
    unique(table.checks.map(check => check.name), `check names in ${table.name}`);
    for (const check of table.checks) {
      if (/;|--|\/\*|\*\/|\b(select|insert|update|delete|drop|alter|create|exec|execute|pragma|attach|detach|load_extension|pg_|sleep|benchmark)\b/i.test(check.expression)) throw new AppError(`Unsafe check expression in ${table.name}. Only scalar CHECK predicates are allowed.`);
      if (!/^[a-zA-Z0-9_\s'"().,<>!=+*/%\-]+$/.test(check.expression)) throw new AppError(`Unsupported CHECK syntax in ${table.name}.`);
      const predicate = check.expression.replace(/'(?:''|[^'])*'/g, "''");
      for (const match of predicate.matchAll(/\b([a-z_][a-z0-9_]*)\s*\(/gi)) if (!["in", "not", "and", "or", "coalesce", "abs", "lower", "upper"].includes(match[1].toLowerCase())) throw new AppError(`Unsupported CHECK function ${match[1]} in ${table.name}.`);
    }
    for (const column of table.columns) {
      if (column.type === "decimal" && (column.scale ?? 2) > (column.precision ?? 12)) throw new AppError(`Decimal scale exceeds precision: ${table.name}.${column.name}`);
      if (!column.nullable && column.default === null) throw new AppError(`Non-null column ${table.name}.${column.name} cannot default to NULL.`);
    }
    for (const key of table.foreignKeys) {
      checkColumns(key.columns);
      const parent = design.tables.find(candidate => candidate.name === key.refTable);
      if (!parent || key.columns.length !== key.refColumns.length) throw new AppError(`Invalid foreign key in ${table.name}.`);
      const parentKey = [parent.primaryKey, ...parent.unique, ...parent.indexes.filter(index => index.unique).map(index => index.columns)].some(names => JSON.stringify(names) === JSON.stringify(key.refColumns));
      if (!parentKey) throw new AppError(`${table.name} must reference a primary or unique key of ${key.refTable}.`);
      key.columns.forEach((name, position) => {
        const target = parent.columns.find(column => column.name === key.refColumns[position]);
        const source = columns.get(name)!;
        if (!target || target.type !== source.type || (target.type === "string" && (target.length ?? 255) !== (source.length ?? 255))) throw new AppError(`Foreign key types differ in ${table.name}.${name}.`);
        if (key.onDelete === "SET NULL" && !source.nullable) throw new AppError(`SET NULL requires nullable columns: ${table.name}.${name}.`);
      });
    }
    const rowKeys = new Map<string, Set<string>>();
    const candidateKeys = [table.primaryKey, ...table.unique, ...table.indexes.filter(index => index.unique).map(index => index.columns)];
    for (const row of table.rows) {
      for (const key of Object.keys(row)) if (!columns.has(key)) throw new AppError(`Seed data has unknown column ${table.name}.${key}.`);
      for (const column of table.columns) {
        const value = Object.hasOwn(row, column.name) ? row[column.name] : column.default ?? null;
        if (value === null && !column.nullable) throw new AppError(`Seed row is missing ${table.name}.${column.name}.`);
        if (value !== null) {
          if (["integer", "bigint"].includes(column.type) && (typeof value !== "number" || !Number.isSafeInteger(value))) throw new AppError(`Expected safe integer in ${table.name}.${column.name}.`);
          if (column.type === "decimal" && typeof value !== "number") throw new AppError(`Expected decimal in ${table.name}.${column.name}.`);
          if (column.type === "boolean" && typeof value !== "boolean") throw new AppError(`Expected boolean in ${table.name}.${column.name}.`);
          if (["string", "text", "uuid", "date", "timestamp", "json"].includes(column.type) && typeof value !== "string") throw new AppError(`Expected text in ${table.name}.${column.name}.`);
          if (column.type === "string" && String(value).length > (column.length ?? 255)) throw new AppError(`Seed string exceeds length in ${table.name}.${column.name}.`);
          if (column.type === "json") { try { JSON.parse(String(value)); } catch { throw new AppError(`Invalid JSON in ${table.name}.${column.name}.`); } }
          if (column.type === "uuid" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value))) throw new AppError(`Invalid UUID in ${table.name}.${column.name}.`);
          if (["date", "timestamp"].includes(column.type) && !Number.isFinite(Date.parse(String(value)))) throw new AppError(`Invalid date/timestamp in ${table.name}.${column.name}.`);
        }
      }
      for (const key of candidateKeys) {
        const values = key.map(name => Object.hasOwn(row, name) ? row[name] : columns.get(name)?.default ?? null);
        if (values.includes(null)) continue;
        const label = key.join(",");
        const seen = rowKeys.get(label) ?? new Set<string>();
        const signature = JSON.stringify(values);
        if (seen.has(signature)) throw new AppError(`Duplicate seed key in ${table.name} (${label}).`);
        seen.add(signature); rowKeys.set(label, seen);
      }
      for (const key of table.foreignKeys) {
        const values = key.columns.map(name => Object.hasOwn(row, name) ? row[name] : columns.get(name)?.default ?? null);
        if (values.some(value => value === null)) continue;
        const parent = design.tables.find(candidate => candidate.name === key.refTable)!;
        if (!parent.rows.some(parentRow => key.refColumns.every((name, position) => (Object.hasOwn(parentRow, name) ? parentRow[name] : parent.columns.find(column => column.name === name)?.default ?? null) === values[position]))) throw new AppError(`Seed foreign key has no parent: ${table.name} → ${key.refTable}.`);
      }
    }
  }
  orderedTables(design);
}

export function generateSQL(design: Design, dbms: DBMS): { schema: string; seed: string } {
  validateDesign(design);
  const quote = (name: string) => quoteIdentifier(name, dbms);
  const tables = orderedTables(design);
  const comment = (text: string) => text.replace(/\r\n?|\n/g, "\n-- ");
  const schema: string[] = [`-- ${comment(design.name)}\n-- Target: ${dbms}. Run in a new, empty database.\n-- IDs are explicitly supplied by the application; no identity/sequence allocation is assumed.\n`];
  if (dbms === "SQLite") schema.push("PRAGMA foreign_keys = ON;\n");
  if (dbms === "MySQL") schema.push("SET NAMES utf8mb4;\n");
  for (const table of tables) {
    const definitions = table.columns.map(column => {
      const defaultLiteral = column.default === undefined ? undefined : sqlLiteral(column.default, dbms);
      const defaultValue = dbms === "MySQL" && typeof column.default === "string" ? `(${defaultLiteral})` : defaultLiteral;
      return `  ${quote(column.name)} ${sqlType(column, dbms)}${column.nullable ? "" : " NOT NULL"}${defaultValue === undefined ? "" : ` DEFAULT ${defaultValue}`}`;
    });
    definitions.push(`  PRIMARY KEY (${table.primaryKey.map(quote).join(", ")})`);
    table.unique.forEach(names => definitions.push(`  UNIQUE (${names.map(quote).join(", ")})`));
    table.checks.forEach(check => definitions.push(`  CONSTRAINT ${quote(check.name)} CHECK (${check.expression})`));
    columnDomainChecks(table, dbms).forEach(expression => definitions.push(`  CHECK (${expression})`));
    table.foreignKeys.forEach(key => definitions.push(`  FOREIGN KEY (${key.columns.map(quote).join(", ")}) REFERENCES ${quote(key.refTable)} (${key.refColumns.map(quote).join(", ")}) ON DELETE ${dbms === "SQL Server" && key.onDelete === "RESTRICT" ? "NO ACTION" : key.onDelete}`));
    schema.push(`CREATE TABLE ${quote(table.name)} (\n${definitions.join(",\n")}\n)${dbms === "MySQL" ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : ""};\n`);
    table.indexes.forEach(index => schema.push(`CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${quote(index.name)} ON ${quote(table.name)} (${index.columns.map(quote).join(", ")});\n`));
    automaticIndexes(table).forEach(index => schema.push(`CREATE INDEX ${quote(index.name)} ON ${quote(table.name)} (${index.columns.map(quote).join(", ")});\n`));
  }
  const seed = [`-- Meaningful sample data for ${comment(design.name)}\n-- Execute after schema.sql in the same empty database.\n${dbms === "SQLite" ? "PRAGMA foreign_keys = ON;\n" : ""}${dbms === "SQL Server" ? "BEGIN TRANSACTION;" : "BEGIN;"}\n`];
  for (const table of tables) {
    const names = table.columns.map(column => column.name);
    seed.push(`-- ${comment(table.purpose)}\nINSERT INTO ${quote(table.name)} (${names.map(quote).join(", ")}) VALUES\n${table.rows.map(row => `  (${table.columns.map(column => sqlLiteral(Object.hasOwn(row, column.name) ? row[column.name] : column.default ?? null, dbms)).join(", ")})`).join(",\n")};\n`);
  }
  seed.push("COMMIT;\n");
  return { schema: schema.join("\n"), seed: seed.join("\n") };
}

export function mermaidDiagram(design: Design, dbms?: DBMS): string {
  const lines = ["erDiagram"];
  for (const table of design.tables) {
    lines.push(`  ${table.name} {`);
    for (const column of table.columns) {
      const keys = [table.primaryKey.includes(column.name) ? "PK" : "", table.foreignKeys.some(key => key.columns.includes(column.name)) ? "FK" : ""].filter(Boolean);
      lines.push(`    ${dbms ? sqlType(column, dbms).replace(/[^a-zA-Z0-9_]/g, "_") : column.type} ${column.name}${keys.length ? ` ${keys.join(",")}` : ""}`);
    }
    lines.push("  }");
    table.foreignKeys.forEach(key => {
      const optional = key.columns.some(name => table.columns.find(column => column.name === name)?.nullable);
      const isUnique = relationshipIsUnique(table, key.columns);
      lines.push(`  ${key.refTable} ${optional ? "|o" : "||"}--${isUnique ? "o|" : "o{"} ${table.name} : "${key.columns.join("_")}"`);
    });
  }
  return lines.join("\n");
}
