# DBMS selection

## Selected: SQLite

SQLite remains the optimal choice because the system is a single-user offline application; the review corrections (date-only fields, clarified email handling) do not change the deployment model or requirements, and SQLite's CHECK constraints, UNIQUE enforcement, and RESTRICT foreign keys fully support the design.

## Requirements-based comparison

Scores are relative suitability judgments for this workload, not measured performance benchmarks.

| DBMS | Fit / 10 | Strengths | Trade-offs | Decision |
| --- | --- | --- | --- | --- |
| SQLite | 9 | Zero-configuration serverless architecture, direct local file access, lightweight, supports CHECK constraints and RESTRICT foreign keys, easy file-based backups. | Lacks multi-user concurrent writes, but the application serializes writes and runs on a single offline workstation anyway. | Selected. Explicitly requested and ideally suited for a single-user, offline, low-complexity local deployment. |
| PostgreSQL | 7 | Robust open-source engine, excellent SQL standard support, strong data integrity and concurrency features. | Requires running a background server, client-server configuration, and ongoing administrative overhead for a single-user app. | Rejected. Over-engineered for a simple single-user desktop app; introduces unnecessary server and operational complexity. |
| MySQL | 6 | Popular relational database with good performance and standard client-server capabilities. | Requires a running server daemon and client-server networking, adding unnecessary deployment overhead for a local tool. | Rejected. Server-based architecture is unnecessary and adds complexity for a single-user offline application. |
| SQL Server | 5 | Enterprise-grade features, robust engine, and powerful official management tooling. | Heavy licensing costs, large resource footprint, and complex installation for a simple local database. | Rejected. Excessive licensing costs and administrative complexity for a small single-user desktop system. |

## Source of decision

Based on the original brief and all 2 completed interview rounds in requirements.md.
