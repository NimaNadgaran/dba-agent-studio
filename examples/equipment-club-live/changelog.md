# Design changelog

## v2 — 2026-11-13T19:31:14.748Z

**Request:** Add an optional phone string to members, length 30. Include populated and NULL phone sample values, update privacy and normalization notes, and preserve all other requirements and SQLite.

Added an optional phone column (string, length 30) to the members table, updated sample rows to include populated and NULL values, and revised normalization and privacy notes accordingly. All other constraints and tables remain unchanged.

**Affected files:** requirements.md, dbms-choice.md, conceptual-model.md, logical-schema.md, normalization.md, assumptions.md, design.json, changelog.md, schema.sql (invalidated), seed.sql (invalidated), validation.md (invalidated)

## v3 — 2026-11-13T19:34:03.294Z

**Request:** Correct two review findings. The original brief explicitly requested date-only borrowed_on and returned_on: change both to abstract date, with YYYY-MM-DD seed values, not timestamps. Correct the contradictory email assumption: the database enforces email uniqueness through UNIQUE, while email format validation belongs to the application. Preserve all three entities, keys, constraints, loan history, optional phone string length 30, populated and NULL phone samples, and SQLite. Document these review corrections.

Review corrections applied: borrowed_on and returned_on in the loans table were changed from timestamp to date (UTC, YYYY-MM-DD) with date-only seed values, matching the original brief. The email assumption was corrected so the database enforces uniqueness via the UNIQUE constraint while email format validation remains an application responsibility. All other entities, keys, constraints, loan history, optional phone string (length 30) with populated and NULL samples, RESTRICT deletion, and SQLite remain unchanged. Dependencies updated accordingly: assumptions, column descriptions, and loan sample rows.

**Affected files:** requirements.md, dbms-choice.md, conceptual-model.md, logical-schema.md, normalization.md, assumptions.md, design.json, changelog.md, schema.sql (invalidated), seed.sql (invalidated), validation.md (invalidated)

## Approval

Design v3 explicitly approved at 2026-11-13T19:34:03.304Z.
