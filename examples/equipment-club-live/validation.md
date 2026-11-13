# SQL validation

**Engine:** SQLite · sql.js

**Status:** passed

**Attempts:** 1

**Duration:** 30 ms

| Check | Result | Detail |
| --- | --- | --- |
| Canonical integrity | PASS | Unique keys, column types, FK targets, nullability and sample references checked. |
| Execute schema.sql | PASS | Executed in isolated SQLite (sql.js), foreign keys enabled. |
| Execute seed.sql | PASS | Real SQLite CHECK, UNIQUE, NOT NULL and FK constraints active. |
| Foreign key check | PASS | No foreign-key violations. |
| SQLite integrity | PASS | ok |
| Rows: members | PASS | 3 sample rows; expected 3. |
| Rows: items | PASS | 3 sample rows; expected 3. |
| Rows: loans | PASS | 4 sample rows; expected 4. |

## Scope

Schema and seed executed in an isolated, disposable embedded engine. No external or production database was modified. This verifies execution and populated tables, not every domain requirement, concurrency behavior, performance, or production permissions.

## Attempt history

- Attempt 1: passed on SQLite · sql.js
- Attempt 2: passed on SQLite · sql.js
- Attempt 3: passed on SQLite · sql.js
