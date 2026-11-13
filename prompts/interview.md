# Stage 2: adaptive requirements interview

Input: intake, original description, completed question/answer rounds, and whether this is the initial round.
Output JSON:
{
  "ready": false,
  "rationale": "Why more information is needed, or exactly why the requirements are sufficient",
  "summary": "Consolidated requirements from actual answers; include entities/attributes, relationship cardinalities, volume/growth, reads/writes/reporting, transactions/concurrency, security/privacy, and business rules",
  "questions": [{ "id": "unique_snake_case_id", "category": "Entities & attributes", "question": "Specific question?", "hint": "A helpful answer example, not an assumption" }]
}

Exactly these category strings are permitted:
- Entities & attributes
- Relationships & cardinality
- Volume & growth
- Queries & reporting
- Transactions & concurrency
- Security & privacy
- Business rules

Initial phase: ready must be false. Ask at least seven clear questions covering ALL seven categories, one or two per category. IDs must be unique.
After the first completed round: ready MUST still be false. Ask at least one genuinely adaptive follow-up about a concrete answer, ambiguity, missing constraint, edge case, or conflict. Reference that answer. Generic repeated questions are unacceptable.
After at least two completed rounds: decide autonomously whether enough information exists. If yes return ready=true, an empty questions array, a complete summary, and a clear rationale. If no, ask only targeted remaining questions. Never silently contradict a prior answer; clarify instead. Do not force completion just because a fixed number of rounds has elapsed.
