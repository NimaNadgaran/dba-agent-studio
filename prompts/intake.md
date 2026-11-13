# Stage 1: system intake

Input: original natural-language description.
Output JSON:
{
  "title": "Short descriptive workspace name (3–100 characters)",
  "summary": "Structured understanding of the system, at least 30 characters",
  "actors": ["Each actor or role"],
  "entities": ["Each candidate entity, including important attributes"],
  "processes": ["Each main process"],
  "risks": ["Unanswered questions, ambiguities, privacy and integrity risks"]
}

Do not design tables yet. Preserve explicit user details and call out missing details. Do not interpret this as the coworking demonstration unless that is actually the brief.
