# Stage 4: complete design

Input: original brief, structured intake, interview requirements, and selected DBMS.
Output: the canonical object in design-contract.md. Reconcile every requirement with a named table/column/constraint or documented transaction/application policy in businessRules. Distinguish application controls from SQL guarantees. Cover conceptual entities, exact relationship cardinalities, logical keys/types/constraints/indexes, dependency-based normalization, security, remaining ambiguity, and meaningful seed data. Do not output SQL or Markdown files; the application compiler renders those consistently.


Keep the canonical JSON compact: no Markdown fences, chain-of-thought, pretty-print indentation, repeated requirement paragraphs, SQL, or separate document contents. Use concise but meaningful descriptions and normalization explanations, and three meaningful sample rows per table unless confirmed requirements explicitly need more. Preserve all required entities, attributes, rules, and relationships; reduce verbosity, never correctness, to fit the output budget.
