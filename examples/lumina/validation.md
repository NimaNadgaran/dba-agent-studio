# SQL validation

**Engine:** PostgreSQL · PGlite

**Status:** passed

**Attempts:** 1

**Duration:** 878 ms

| Check | Result | Detail |
| --- | --- | --- |
| Canonical integrity | PASS | Unique keys, column types, FK targets, nullability and sample references checked. |
| Execute schema.sql | PASS | Executed in isolated PostgreSQL (PGlite). |
| Execute seed.sql | PASS | All constraints and FK checks active. |
| Rows: members | PASS | 3 meaningful sample rows; expected 3. |
| Rows: plans | PASS | 3 meaningful sample rows; expected 3. |
| Rows: memberships | PASS | 3 meaningful sample rows; expected 3. |
| Rows: spaces | PASS | 3 meaningful sample rows; expected 3. |
| Rows: amenities | PASS | 3 meaningful sample rows; expected 3. |
| Rows: space_amenities | PASS | 5 meaningful sample rows; expected 5. |
| Rows: bookings | PASS | 3 meaningful sample rows; expected 3. |
| Rows: invoices | PASS | 3 meaningful sample rows; expected 3. |

## Scope

Schema and seed executed in an isolated, disposable embedded engine. No external or production database was modified. This verifies execution and populated tables, not every domain requirement, concurrency behavior, performance, or production permissions.

## Attempt history

- Attempt 1: passed on PostgreSQL · PGlite
