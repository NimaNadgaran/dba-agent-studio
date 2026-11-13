# Requirements — Lumina coworking

**Status:** Interview complete

## System brief

Design a database for Lumina, a coworking platform with 3 locations. Members subscribe to monthly plans and book meeting rooms or desks. Members can optionally select a preferred space. Spaces have shared amenities, capacities, and hourly rates. Track membership history, bookings (confirmed, completed, cancelled), and invoices. Support 5,000 members, 100,000 bookings per year, staff reporting and concurrent booking requests. Retain billing history and protect member contact details.

## Consolidated requirements

Members need full name, unique email, joined date, active flag, and an optional preferred space. Plans have unique names, monthly price, and included hours. Spaces have a location, unique name per location, capacity and hourly rate. Bookings use UTC start/end and confirmed/completed/cancelled states. Invoices track issue/due dates, amount and draft/paid/overdue states.

Members have many historical memberships; a membership has one member and one plan. A member can optionally choose one preferred space; a space can be preferred by many members. Members make many bookings, each for one space. Spaces share amenities through a many-to-many link. Each invoice belongs to one member; invoices can exist without bookings.

5,000 initial members, 100,000 bookings/year, 3 locations growing to 10, around 30% annual data growth. Keep invoices for seven years and bookings for two years.

Frequent availability searches by location and time, daily staff booking lists, member booking history, monthly occupancy, and overdue-invoice reports. Roughly 20 reads per write.

No overlapping confirmed bookings for a space. The application serializes reservations with a per-space lock and an overlap query inside the same transaction. Invoice status transitions are atomic and idempotent. Around 50 concurrent reservations at peak.

Members only access their own records. Staff can manage bookings for assigned locations; only billing admins see invoices. No payment card details or passwords stored here. Anonymize contact data instead of deleting retained billing evidence.

Booking end must follow start; dates use UTC. Capacity must be positive, rates and invoice amounts nonnegative, emails unique, and due date cannot precede issue date. Cancelled bookings remain for audit and do not block availability.

Yes, lock the space row during each booking transaction and reject any intersecting confirmed interval. Back-to-back reservations are allowed. Members can have multiple non-overlapping memberships over time; enforcing membership interval exclusivity is also a transaction-level policy.

Retain invoice records for seven years, keep a minimal anonymized member record as their FK target, and store all booking timestamps as UTC. Cancellation retains the original reservation and its status.

## Interview round 1

### Entities & attributes

**Question:** Which attributes do members, spaces, plans, bookings, and invoices need?

**Answer:** Members need full name, unique email, joined date, active flag, and an optional preferred space. Plans have unique names, monthly price, and included hours. Spaces have a location, unique name per location, capacity and hourly rate. Bookings use UTC start/end and confirmed/completed/cancelled states. Invoices track issue/due dates, amount and draft/paid/overdue states.

### Relationships & cardinality

**Question:** Can members hold multiple memberships, and can spaces share the same amenities?

**Answer:** Members have many historical memberships; a membership has one member and one plan. A member can optionally choose one preferred space; a space can be preferred by many members. Members make many bookings, each for one space. Spaces share amenities through a many-to-many link. Each invoice belongs to one member; invoices can exist without bookings.

### Volume & growth

**Question:** How much data and annual growth should the platform support?

**Answer:** 5,000 initial members, 100,000 bookings/year, 3 locations growing to 10, around 30% annual data growth. Keep invoices for seven years and bookings for two years.

### Queries & reporting

**Question:** Which availability searches, reports, and write operations matter most?

**Answer:** Frequent availability searches by location and time, daily staff booking lists, member booking history, monthly occupancy, and overdue-invoice reports. Roughly 20 reads per write.

### Transactions & concurrency

**Question:** How should simultaneous reservations and payment updates behave?

**Answer:** No overlapping confirmed bookings for a space. The application serializes reservations with a per-space lock and an overlap query inside the same transaction. Invoice status transitions are atomic and idempotent. Around 50 concurrent reservations at peak.

### Security & privacy

**Question:** Who can access member contact details, bookings, and billing data?

**Answer:** Members only access their own records. Staff can manage bookings for assigned locations; only billing admins see invoices. No payment card details or passwords stored here. Anonymize contact data instead of deleting retained billing evidence.

### Business rules

**Question:** What cancellation, pricing, invoice, and date-range rules must always hold?

**Answer:** Booking end must follow start; dates use UTC. Capacity must be positive, rates and invoice amounts nonnegative, emails unique, and due date cannot precede issue date. Cancelled bookings remain for audit and do not block availability.



## Interview round 2

### Transactions & concurrency

**Question:** You require no double bookings: should reservations lock the space in a transaction, and may bookings be back-to-back?

**Answer:** Yes, lock the space row during each booking transaction and reject any intersecting confirmed interval. Back-to-back reservations are allowed. Members can have multiple non-overlapping memberships over time; enforcing membership interval exclusivity is also a transaction-level policy.

### Security & privacy

**Question:** You need privacy and seven-year billing retention: should contact details be anonymized while invoices keep their member link?

**Answer:** Retain invoice records for seven years, keep a minimal anonymized member record as their FK target, and store all booking timestamps as UTC. Cancellation retains the original reservation and its status.



## Interview decision

All seven dimensions are covered. Follow-up confirmed half-open booking intervals, per-space transaction locks, membership exclusivity, UTC, and privacy-preserving invoice retention.

## Outstanding questions

- None identified.
