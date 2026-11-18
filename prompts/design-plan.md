# Stage 4a: small design plan

Return ONLY a compact JSON object. Plan the database; do not generate columns, constraints, sample rows, SQL, diagrams, or document text yet. Another request will build each table separately.

Contract:
{"name":"System name","overview":"Architecture overview of at least 30 characters","tables":[{"name":"parents","purpose":"Purpose of this table, at least 10 characters","dependsOn":[]},{"name":"children","purpose":"Purpose of this table, at least 10 characters","dependsOn":["parents"]}],"assumptions":["Reviewable ambiguity"],"businessRules":["Requirement mapped to a planned table and SQL constraint or application/transaction enforcement"],"security":["Access, privacy, retention and sensitive data controls"],"denormalizations":[]}

- Preserve every confirmed entity, attribute, relationship and rule. Include associative tables for many-to-many relationships; do not invent unrelated features or replace the domain with a generic records table.
- Return 1 to 30 tables. Names are ASCII lowercase_snake_case, start with a letter and are at most 48 characters. Each table name must be unique.
- Order tables parent-first. dependsOn lists every other table it will reference by foreign key, using only names that appear earlier. Do not list self-references. Avoid cycles with deliberate associative-table design; never discard a required relationship to avoid a cycle.
- All table columns, dependency analysis and seed data will be supplied later, one table at a time. Use each purpose to identify key attributes and required relationships concisely, not detailed column JSON.
- Keep overview and arrays concise. State how every business rule is enforced without claiming a row CHECK can enforce cross-row totals, overlapping dates, authorization or concurrency. State necessary transaction/application policies instead.
- Match the selected DBMS and confirmed answers. Distinguish assumptions from requirements. Do not add passwords, credentials, SQL or prose outside the JSON object.

