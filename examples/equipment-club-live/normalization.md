# Normalization analysis

**Design version:** 3 · **Target:** SQLite

## Method

1NF requires atomic attributes and unique rows. 2NF excludes partial dependencies on part of a composite candidate key. 3NF excludes non-key transitive dependencies. Surrogate primary keys alone do not prove 3NF. The following dependency claims must be reviewed against the actual business semantics.

## members

### Functional dependencies

- id -> full_name, email, phone
- email -> id, full_name, phone

### Normal-form assessment

The table is in 3NF: all non-key attributes depend on the primary key id, and email is a candidate key with no transitive dependencies; phone is also functionally dependent on id.

## items

### Functional dependencies

- id -> asset_tag, name
- asset_tag -> id, name

### Normal-form assessment

In 3NF: all attributes depend on the primary key, and asset_tag is a candidate key with no transitive dependencies.

## loans

### Functional dependencies

- id -> member_id, item_id, borrowed_on, returned_on

### Normal-form assessment

In 3NF: all attributes depend on the primary key; no transitive dependencies; foreign keys are required.

## Deliberate denormalization

No deliberate denormalization. Every table is intended to satisfy at least 3NF.

## Validation boundary

Execution checks prove syntax and constraint/seed compatibility, not the truth of functional dependencies. A human must confirm semantic normalization.
