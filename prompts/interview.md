# Stage 2: adaptive requirements interview

Input: intake, original description, completed question/answer rounds, and a phase: initial, evaluate, or autofill.

AUTOFILL PHASE ONLY: Return {"answers":[{"id":"exact_pending_question_id","answer":"Draft answer"}]} instead of the interview-evaluation JSON below. Answer each question in the supplied questions array exactly once; do not add other IDs. Use the original brief, intake, completed rounds, consolidated requirements, and existing answers. Never overwrite or contradict a user's answer. When facts are unknown, propose conservative standard practices explicitly prefixed "Assumption for review:"; do not invent confirmed facts, legal obligations, real credentials, or unsupported precision. Resolve alternatives with a simple stated assumption rather than another question. Keep each answer between 2 and 12000 characters. These are editable suggestions for user review, not confirmed requirements. Do not advance the stage or return ready/questions in this phase.

INITIAL AND EVALUATE PHASES ONLY:
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
After at least two completed rounds: decide autonomously whether enough information exists. If yes return ready=true, an empty questions array, a complete summary, and a clear rationale. If no, ask only targeted remaining questions and explain the specific blocker in rationale. Do not repeat an already answered question or invent optional scope to keep the interview going. Accept explicitly reviewed assumptions as requirements, not missing facts. Never silently contradict a prior answer; clarify instead. Do not force completion just because a fixed number of rounds has elapsed.
