# Canonical design JSON contract

Return a single JSON object with exactly the following structure. This model is compiled into ALL design documents and dialect-specific SQL; do not return independently authored files.

{
  "name": "System name",
  "overview": "At least 30 characters of architecture explanation",
  "tables": [{
    "name": "lowercase_snake_case",
    "purpose": "Purpose, at least 10 characters",
    "columns": [{
      "name": "lowercase_snake_case",
      "type": "integer",
      "nullable": false,
      "description": "Meaning of the attribute",
      "length": 255,
      "precision": 12,
      "scale": 2
    }],
    "primaryKey": ["id"],
    "unique": [["email"]],
    "foreignKeys": [{"columns":["parent_id"],"refTable":"parents","refColumns":["id"],"onDelete":"RESTRICT"}],
    "checks": [{"name":"table_named_check","expression":"amount >= 0"}],
    "indexes": [{"name":"table_lookup_idx","columns":["status"],"unique":false}],
    "functionalDependencies": ["id -> all non-key attributes", "email -> id and other attributes"],
    "normalization": "Explicit 1NF, 2NF, and 3NF analysis based on actual candidate keys and dependencies, at least 20 characters",
    "rows": [{"id":1,"email":"alex@example.org"},{"id":2,"email":"maya@example.org"},{"id":3,"email":"sam@example.org"}]
  }],
  "assumptions": ["Explicit, reviewable assumptions and remaining ambiguities"],
  "businessRules": ["Every user business rule and precisely where enforced: SQL constraint or application/transaction policy"],
  "security": ["Roles, access boundaries, privacy, retention, and sensitive-data handling; never seed plaintext passwords"],
  "denormalizations": ["Each deliberate departure from 3NF with a workload-specific justification and consistency policy; empty when none"]
}

- Names are ASCII lowercase identifiers, begin with a letter, contain only letters/digits/underscores, maximum 48 characters. Avoid SQL reserved words for columns used in checks. All index names must be globally unique. CHECK constraint names should be globally unique too.
- Supported abstract column types: integer, bigint, string, text, decimal, boolean, date, timestamp, uuid, json. Use string with length (default 255); decimal with precision/scale (default 12,2). Optional literal default can be a scalar or null, NOT an SQL expression. Omit length/precision/scale when inapplicable. Timestamps are ISO strings, decimals numeric values, booleans JSON booleans, JSON values serialized strings. IDs must be explicit safe integers or UUID strings; the compiler does NOT allocate auto-increment IDs.
- Every table needs a non-null primary key, at least 3 meaningful sample rows, and all the listed arrays (empty arrays are fine). Maximum 30 tables / 50 columns per table / 30 sample rows per table. Preserve every explicit entity, attribute, and rule from requirements. Never compress an entire complex domain into a generic records table.
- Model many-to-many links with an associative table and a composite primary/unique key. Use FK column lists to support composite references; referenced columns must form a declared primary or unique key. FK types and lengths must exactly match their referenced types. SET NULL requires nullable columns.
- Use sensible deletion actions; do not cascade-delete retained financial or historical evidence. Avoid cyclic foreign-key graphs; model lifecycle links through nullable associations or dedicated link tables. Do not add redundant transitive attributes.
- Declare indexes that support actual query patterns. The compiler automatically adds FK indexes missing leading-column coverage.
- CHECK expressions must use portable scalar predicates with unquoted snake_case columns, SQL single-quoted string literals, comparisons, AND/OR/NOT, IN, IS NULL, arithmetic, and optional COALESCE/ABS/LOWER/UPPER only. Never use subqueries, DDL, semicolons, comments, vendor-specific functions, external functions, or procedural SQL. For boolean checks use 0/1 only when appropriate to target DBMS; prefer no raw boolean check because the compiler enforces the abstract boolean domain.
- Seed all required attributes, unique/composite keys, FK values, checks, and sensible timestamp ordering. Parent rows must exist. Include junction links, optional nulls, multiple valid statuses, distinct users, and important boundary cases. Do not use test1/test2 or empty placeholders. Null is different from an omitted default. Use ISO dates. Values must match types. Do not manufacture credentials.
- Rules involving overlapping date ranges, aggregate balances, capacity across rows, authorization, or concurrent writes need explicit transaction/locking/application enforcement unless a correctly modeled SQL constraint can handle them. Do NOT falsely claim that a row-level CHECK prevents double booking or enforces totals across tables.
- State semantically meaningful functional dependencies and analyze candidate keys. Surrogate keys alone do not demonstrate normalization. Enumerations are CHECK-constrained or reference tables; do not duplicate mutable labels as key attributes.
- Cross-check every prose claim against the actual model before returning it. Do not say that a UNIQUE-constrained email lacks uniqueness validation. Distinguish application format validation from database uniqueness enforcement. Preserve explicitly requested date-only fields as date, not timestamp. SQLite VARCHAR(n) limits are enforced by compiler-added length CHECKs, not by the type declaration alone.
- For SQL Server avoid multiple cascade paths. For MySQL target 8.0.16+ / MariaDB with enforced CHECK support. Export assumes a pre-existing empty database; no privileged CREATE DATABASE or USE statements.
