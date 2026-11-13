# Normalization analysis

**Design version:** 2 · **Target:** PostgreSQL

## Method

1NF requires atomic attributes and unique rows. 2NF excludes partial dependencies on part of a composite candidate key. 3NF excludes non-key transitive dependencies. Surrogate primary keys alone do not prove 3NF. The following dependency claims must be reviewed against the actual business semantics.

## members

### Functional dependencies

- id → full_name, email, joined_on, active, preferred_space_id, phone
- email → id, full_name, joined_on, active, preferred_space_id, phone

### Normal-form assessment

1NF: each column contains an atomic value. 2NF: the single-column primary key has no partial dependencies. 3NF: non-key attributes depend on a candidate key, not on another non-key attribute; related mutable facts live in their own relations.

## plans

### Functional dependencies

- id → name, monthly_price, included_hours
- name → id, monthly_price, included_hours

### Normal-form assessment

1NF: each column contains an atomic value. 2NF: the single-column primary key has no partial dependencies. 3NF: non-key attributes depend on a candidate key, not on another non-key attribute; related mutable facts live in their own relations.

## memberships

### Functional dependencies

- id → member_id, plan_id, starts_on, ends_on
- (member_id, starts_on) → id, plan_id, ends_on

### Normal-form assessment

1NF: each column contains an atomic value. 2NF: the single-column primary key has no partial dependencies. 3NF: non-key attributes depend on a candidate key, not on another non-key attribute; related mutable facts live in their own relations.

## spaces

### Functional dependencies

- id → name, location, capacity, hourly_rate
- (location, name) → id, capacity, hourly_rate

### Normal-form assessment

1NF: each column contains an atomic value. 2NF: the single-column primary key has no partial dependencies. 3NF: non-key attributes depend on a candidate key, not on another non-key attribute; related mutable facts live in their own relations.

## amenities

### Functional dependencies

- id → name
- name → id

### Normal-form assessment

1NF: each column contains an atomic value. 2NF: the single-column primary key has no partial dependencies. 3NF: non-key attributes depend on a candidate key, not on another non-key attribute; related mutable facts live in their own relations.

## space_amenities

### Functional dependencies

- (space_id, amenity_id) is the sole candidate key; there are no non-key attributes

### Normal-form assessment

1NF: each link is atomic and unique. 2NF: there are no non-key attributes to depend on part of the composite key. 3NF and BCNF: no nontrivial functional dependency has a non-superkey determinant.

## bookings

### Functional dependencies

- id → every non-key attribute

### Normal-form assessment

1NF: each column contains an atomic value. 2NF: the single-column primary key has no partial dependencies. 3NF: non-key attributes depend on a candidate key, not on another non-key attribute; related mutable facts live in their own relations.

## invoices

### Functional dependencies

- id → member_id, invoice_number, issued_on, due_on, amount, status
- invoice_number → id, member_id, issued_on, due_on, amount, status

### Normal-form assessment

1NF: each column contains an atomic value. 2NF: the single-column primary key has no partial dependencies. 3NF: non-key attributes depend on a candidate key, not on another non-key attribute; related mutable facts live in their own relations.

## Deliberate denormalization

No deliberate denormalization. Every table is intended to satisfy at least 3NF.

## Validation boundary

Execution checks prove syntax and constraint/seed compatibility, not the truth of functional dependencies. A human must confirm semantic normalization.
