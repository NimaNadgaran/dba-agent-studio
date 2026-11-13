# Database-design critique and workflow fixes

This report records real issues found while reviewing the implementation and illustrative design. It distinguishes defects fixed in the workflow from remaining domain/deployment responsibilities.

## 1. Optional relationships were not exercised by the initial seed

**Finding:** The first coworking model included nullable notes/end dates but every FK was mandatory. Null attributes are not the same as an optional relationship. The PDF specifically expects meaningful optional-relationship coverage in seed data.

**Fix:** The example brief/interview now explicitly asks for an optional preferred space. `members.preferred_space_id` is nullable, references `spaces.id`, and uses SET NULL. Example members include both valid parent references and an actual null. The relationship, logical column/FK, seed values and Mermaid cardinality all derive from that model. Dependency ordering now correctly creates spaces before members despite their conceptual list order.

**Verification:** Structural/real execution tests cover all references and values, the optional Mermaid cardinality, FK-safe table order, and populated tables. No invented generic `test1` values are used.

## 2. A literal NULL could incorrectly fall back to a default

**Finding:** The first structural validator used nullish coalescing for seed/default lookup. An explicitly supplied null in a non-null column with a default could therefore pass the structural check, although the SQL compiler would correctly insert NULL and the engine would reject it. This made validation disagree with the actual export.

**Fix:** Seed validation uses property existence (`Object.hasOwn`) rather than nullish fallback. A missing value can use a default; an explicit null remains null. The same semantics apply to candidate-key and FK checks.

**Verification:** A regression deliberately gives a required member name a default plus an explicit null and verifies rejection before execution.

## 3. CHECK validation initially blocked statements but not unsafe functions

**Finding:** Rejecting semicolons, DDL and SQL comments was insufficient. A model could still place an unexpected function call inside a syntactically scalar CHECK expression. Executing that expression is unnecessary risk, even in an isolated validation engine, and may be nonportable.

**Fix:** The canonical contract now permits only portable predicates and a small scalar-function allowlist. Validation strips quoted literals before identifying calls and rejects unknown functions. The workflow compiles its own DDL instead of running arbitrary raw model SQL.

**Verification:** Tests reject an injected DROP statement and an external `dblink_connect(...)` function. Standard status/date/amount checks still execute in both real embedded engines.

## 4. Automatically added indexes needed collision-safe identities

**Finding:** Truncating long table names to construct FK-index names could collide for tables with the same prefix, and duplicate CHECK constraint names can fail globally on SQL Server. Model-declared and compiler-added indexes needed a shared uniqueness check.

**Fix:** Automatic index names include a stable table-name checksum. All declared/generated index names and all CHECK names are validated globally. Documentation lists actual compiler-added index names and columns. Existing leading key/index coverage avoids redundant FK indexes.

## 5. Concurrency is not a row-level CHECK guarantee

**Finding:** A valid booking start/end CHECK alone cannot prevent two simultaneous transactions inserting overlapping reservations. A schema could execute perfectly and still violate the key business rule.

**Fix:** The adaptive follow-up specifically confirms half-open intervals and per-space serialization. The canonical business rules and design prompt explicitly distinguish SQL-enforced row integrity from a transaction-level overlap query with a space lock. SQLite requires serialized writes/BEGIN IMMEDIATE instead of server row locks. Cancelled bookings do not block availability. Membership interval exclusivity is likewise a transaction policy.

**Remaining responsibility:** This project designs databases; it does not implement the client's coworking reservation application. Production transaction code and concurrency/load tests remain necessary. The documentation does not claim otherwise.

## 6. 3NF and business meaning need a human review

Checked candidate keys, composite junction keys, date/status domains, uniqueness, deletion retention, report indexes, optional references, seed coverage and FD statements. The example keeps mutable plan facts separate from memberships and uses a pure space/amenity junction. Invoice amount is an independent billed fact, not an undocumented aggregate of nonexistent line items. Locations remain labels only because the example requests no address/manager attributes. If location details, detailed invoice lines, plan-price history or allowance consumption become requirements, revise the schema rather than hiding them in arbitrary text.

The workflow now warns that surrogate primary keys do not prove 3NF, lists explicit dependencies, and documents assumptions. It preserves review/approval after automatic model repair. Actual engine execution proves executable integrity for those seeded rows, not normalization, complete authorization, retention scheduling, performance, or unseen-model semantic quality.
