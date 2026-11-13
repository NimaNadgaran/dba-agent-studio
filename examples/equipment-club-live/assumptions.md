# Assumptions and remaining ambiguity

**Design version:** 3 · **Target:** SQLite

- No limit on the number of open loans a member can have simultaneously.
- The application enforces at most one open loan per item inside a transaction; the database does not have a constraint for this rule.
- Email addresses are not format-validated by the database; the database enforces uniqueness, while format validation is an application responsibility.
- Asset tags are unique but not verified to be physically attached to items.
- Backup strategy is not detailed; regular file-based backups are assumed.
- Database file access is controlled entirely by OS permissions; no additional encryption or authentication table is used.
- borrowed_on and returned_on are date-only UTC values stored as YYYY-MM-DD strings (review correction).
- IDs are integers assigned by the application; the database does not use auto-increment.
- Members may have an optional phone number; if provided, it is stored as a string of up to 30 characters.

## Operational assumptions

- Run schema.sql in an existing empty database with appropriate CREATE privileges. Do not run it against production.
- Seed data is synthetic and contains no real personal information.
- Sample data is not an exhaustive performance or security test.
- Monetary decimal values are illustrative; production applications should use exact decimal serialization.
- All generated files derive from one canonical design model, included as design.json in the export.
- The design is model-generated and needs human domain review before production use.
