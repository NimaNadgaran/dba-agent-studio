# Stage 3: choose a relational DBMS

Input: brief and consolidated requirements, with all interview answers.
Output JSON:
{
  "selected": "PostgreSQL",
  "rationale": "At least 30 characters explaining the decision against ACTUAL requirements",
  "comparison": [
    {"dbms":"PostgreSQL","score":9,"strengths":"Workload-specific benefits","tradeoffs":"Real drawbacks","verdict":"Selected or concrete rejection reason"},
    {"dbms":"MySQL","score":7,"strengths":"...","tradeoffs":"...","verdict":"..."},
    {"dbms":"SQLite","score":5,"strengths":"...","tradeoffs":"...","verdict":"..."},
    {"dbms":"SQL Server","score":6,"strengths":"...","tradeoffs":"...","verdict":"..."}
  ]
}

All four DBMSs must appear exactly once. MySQL includes compatible MariaDB deployments. Scores are qualitative fit judgments, not invented benchmark results. Consider concurrency, hosting, deployment, constraints, reporting, operational complexity, existing ecosystem, and budget. An embedded, single-user/offline app often favors SQLite; a Microsoft-centric enterprise might favor SQL Server. Do not always choose PostgreSQL. Do not prematurely generate SQL.
