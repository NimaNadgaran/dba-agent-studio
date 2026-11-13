# DBMS selection

## Selected: PostgreSQL

PostgreSQL fits the multi-user transactional workload, 100,000 bookings per year, 50 concurrent reservations, reporting joins, and seven-year invoice history. Strong constraints and row locks support the documented per-space booking transaction. SQLite remains excellent for an embedded prototype, but is not the preferred concurrent production target.

## Requirements-based comparison

Scores are relative suitability judgments for this workload, not measured performance benchmarks.

| DBMS | Fit / 10 | Strengths | Trade-offs | Decision |
| --- | --- | --- | --- | --- |
| PostgreSQL | 9 | Rich constraints, row locks, analytical joins, transactional integrity | Requires a managed or self-hosted database and operational care | Selected for concurrency and reporting requirements |
| MySQL | 8 | Mature InnoDB transactions, accessible managed hosting | Need careful locking and a version with enforced CHECK constraints | Viable alternative; PostgreSQL better matches rich integrity needs |
| SQLite | 5 | Zero-service deployment and excellent local prototyping | Single-writer limits and no server-side row locking for multi-instance writes | Rejected for the anticipated concurrent production workload |
| SQL Server | 7 | Strong enterprise reporting, transactions and access controls | More operational/licensing considerations; no Microsoft-stack requirement | Rejected absent an existing Microsoft ecosystem requirement |

## Source of decision

Based on the original brief and all 2 completed interview rounds in requirements.md.
