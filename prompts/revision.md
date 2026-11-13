# Stage 5: propagate a natural-language revision

Input: approved-or-draft canonical design, requirements, selected DBMS, and revision request.
Output JSON:
{
  "design": { "...": "complete canonical object matching design-contract.md, not a patch" },
  "selected": "PostgreSQL",
  "summary": "What changed, why, and which dependencies were updated",
  "rationale": "Updated DBMS rationale; explain requested switches or retained choice against requirements",
  "comparison": ["Same four structured comparison objects required in selection.md"]
}

Return the WHOLE revised model, preserving unrelated requirements, keys and sample rows. Add/update/remove all affected columns, references, checks, indexes, normalization notes, assumptions, security notes, and sample rows. When making a relationship many-to-many, create a meaningful junction table and remove obsolete direct dependencies. A provider/model selection change is configuration, not a domain revision. If a requested DBMS switch is explicit, honor it and adapt all dialect-sensitive assumptions. Never drop a user's requested feature silently; record infeasibility in assumptions and explain the safe alternative. The application invalidates approval and removes stale SQL after any revision.
