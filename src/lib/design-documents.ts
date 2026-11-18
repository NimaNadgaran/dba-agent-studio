import { automaticIndexes, columnDomainChecks, relationshipIsUnique, sqlType } from "./design";
import type { Session, Table } from "./types";

export const designDocumentNames = ["conceptual-model.md", "logical-schema.md", "normalization.md", "assumptions.md"];

function paragraphs(items: string[], fallback = "None identified.") {
  return items.length ? items.join("\n\n") : fallback;
}

function relationships(table: Table) {
  return table.foreignKeys.map(key => {
    const optional = key.columns.some(name => table.columns.find(column => column.name === name)?.nullable);
    const one = relationshipIsUnique(table, key.columns);
    return "Each " + table.name + " record " + (optional ? "may reference zero or one " : "must reference exactly one ") + key.refTable + " record through " + key.columns.join(", ") + ". Each " + key.refTable + " record can have zero " + (one ? "or one" : "or many") + " related " + table.name + " records. The relationship is " + (one ? "one-to-one" : "many-to-one") + "; parent deletion uses " + key.onDelete + ".";
  });
}

export function designTextOutputs(session: Session): { name: string; title: string; content: string }[] {
  if (!session.design || !session.choice) return [];
  const design = session.design;
  const dbms = session.choice.selected;
  const version = "Design version: " + session.designVersion + ". Target database: " + dbms + ".";
  const conceptual = [
    "Conceptual model: " + design.name, version,
    "This text explains the entity-relationship diagram without requiring an image. Entities represent the things the system records; relationships describe how their records connect.",
    design.overview,
    "Entities", paragraphs(design.tables.map(table => table.name + ": " + table.purpose + "\nAttributes: " + table.columns.map(column => column.name + ": " + column.description).join("; ") + ".")),
    "Relationships and cardinality", paragraphs(design.tables.flatMap(relationships), "There are no cross-entity relationships in this design."),
    "Business rules and enforcement", paragraphs(design.businessRules),
  ].join("\n\n");
  const logical = [
    "Logical schema: " + design.name, version,
    "This text explains the logical schema diagram: each entity becomes a table, attributes become typed columns, and primary and foreign keys identify and connect records. IDs are supplied by the application; automatic ID allocation is not assumed.",
    ...design.tables.map(table => [
      "Table: " + table.name + ". " + table.purpose,
      "Attributes:\n" + table.columns.map(column => column.name + ": " + sqlType(column, dbms) + "; " + (column.nullable ? "optional, NULL allowed" : "required, NULL not allowed") + "; " + column.description + (column.default === undefined ? ". No default value." : ". Default value: " + JSON.stringify(column.default) + ".")).join("\n"),
      "Primary key: " + table.primaryKey.join(", ") + ". This uniquely identifies each record.",
      "Additional unique keys: " + (table.unique.map(names => "(" + names.join(", ") + ")").join("; ") || "none beyond the primary key") + ".",
      "Foreign keys:\n" + paragraphs(table.foreignKeys.map(key => table.name + "(" + key.columns.join(", ") + ") references " + key.refTable + "(" + key.refColumns.join(", ") + "). On parent deletion: " + (dbms === "SQL Server" && key.onDelete === "RESTRICT" ? "NO ACTION" : key.onDelete) + "."), "None."),
      "Row checks:\n" + paragraphs(table.checks.map(check => check.name + ": " + check.expression), "No additional row checks declared."),
      "Compiler-enforced column domains:\n" + paragraphs(columnDomainChecks(table, dbms), "No additional column-domain checks beyond the declared types."),
      "Indexes:\n" + paragraphs([...table.indexes, ...automaticIndexes(table)].map(index => index.name + " on " + index.columns.join(", ") + (index.unique ? "; values must be unique." : "; supports lookups.")), "No additional indexes declared. Primary and unique keys are indexed by the database."),
      "Synthetic sample records: " + table.rows.length + ".",
    ].join("\n\n")),
    "Security and privacy", paragraphs(design.security),
    "Security policies describe architectural requirements. Application authentication, encryption at rest and database role provisioning must be implemented at deployment. The SQL export does not create credentials or privileged users.",
  ].join("\n\n");
  const normalization = [
    "Normalization analysis: " + design.name, version,
    "This text explains the dependency structure behind the schema. First normal form requires atomic attributes and unique rows. Second normal form excludes partial dependencies on part of a composite candidate key. Third normal form excludes non-key transitive dependencies. A surrogate primary key alone does not prove third normal form.",
    ...design.tables.map(table => "Table: " + table.name + "\n\nFunctional dependencies:\n" + table.functionalDependencies.join("\n") + "\n\nNormal-form assessment:\n" + table.normalization),
    "Deliberate denormalization", paragraphs(design.denormalizations, "No deliberate denormalization. Every table is intended to satisfy at least third normal form."),
    "Validation boundary", "Execution checks establish syntax and constraint/sample-data compatibility, not the truth of functional dependencies. A human must confirm the business semantics and normalization claims.",
  ].join("\n\n");
  const assumptions = [
    "Assumptions and remaining ambiguity: " + design.name, version,
    "This text explains the assumptions needed to interpret the model and its relationships. Review these decisions before approving the design; unconfirmed assumptions are not established user requirements.",
    "Design assumptions", paragraphs(design.assumptions),
    "Operational assumptions",
    "Run the schema and sample data in an existing empty database with suitable CREATE privileges, never directly against production.",
    "All sample records are synthetic. They are not an exhaustive performance, concurrency or security test. Monetary decimal values are illustrative; production applications need exact decimal serialization.",
    "All four explanations and the SQL derive from one canonical design model, included as design.json in the export. Business rules involving multiple rows, authorization or concurrency require the stated application/transaction controls unless an actual database constraint enforces them.",
    session.mode === "demo" ? "This is the labelled offline coworking example, not an AI interpretation of an arbitrary brief." : "This model-generated design requires human domain review before production use.",
  ].join("\n\n");
  return [
    { name: designDocumentNames[0], title: "Conceptual model", content: conceptual },
    { name: designDocumentNames[1], title: "Logical schema", content: logical },
    { name: designDocumentNames[2], title: "Normalization analysis", content: normalization },
    { name: designDocumentNames[3], title: "Assumptions and remaining ambiguity", content: assumptions },
  ];
}
