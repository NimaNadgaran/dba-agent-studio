# Assumptions and remaining ambiguity

**Design version:** 2 · **Target:** PostgreSQL

- The demonstration is deliberately scoped: locations are labels with no address/manager facts; introduce a locations entity if those attributes become requirements.
- All timestamps represent UTC; timezone conversion occurs at the client boundary.
- A member can have historical memberships. Transactional policy prevents overlapping active membership intervals.
- Amounts use USD and invoices are standalone billed totals, not aggregates of unstored invoice-line records.
- Included hours are a plan allowance; consumption accounting and payment processing are outside this specified sample scope.
- Plans should be versioned rather than mutating prices that need historical interpretation.
- Identifiers are assigned explicitly by the application, not by a sequence.

## Operational assumptions

- Run schema.sql in an existing empty database with appropriate CREATE privileges. Do not run it against production.
- Seed data is synthetic and contains no real personal information.
- Sample data is not an exhaustive performance or security test.
- Monetary decimal values are illustrative; production applications should use exact decimal serialization.
- All generated files derive from one canonical design model, included as design.json in the export.
- This is the explicitly labelled offline coworking example, not an LLM interpretation of an arbitrary brief.
