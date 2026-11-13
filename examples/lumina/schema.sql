-- Lumina coworking platform
-- Target: PostgreSQL. Run in a new, empty database.
-- IDs are explicitly supplied by the application; no identity/sequence allocation is assumed.

CREATE TABLE "plans" (
  "id" INTEGER NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "monthly_price" DECIMAL(12,2) NOT NULL,
  "included_hours" INTEGER NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("name"),
  CONSTRAINT "plans_nonnegative" CHECK (monthly_price >= 0 AND included_hours >= 0)
);

CREATE TABLE "spaces" (
  "id" INTEGER NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "location" VARCHAR(100) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "hourly_rate" DECIMAL(12,2) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("location", "name"),
  CONSTRAINT "spaces_valid_capacity_rate" CHECK (capacity > 0 AND hourly_rate >= 0)
);

CREATE TABLE "members" (
  "id" INTEGER NOT NULL,
  "full_name" VARCHAR(120) NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "joined_on" DATE NOT NULL,
  "active" BOOLEAN NOT NULL,
  "preferred_space_id" INTEGER,
  "phone" VARCHAR(30),
  PRIMARY KEY ("id"),
  UNIQUE ("email"),
  FOREIGN KEY ("preferred_space_id") REFERENCES "spaces" ("id") ON DELETE SET NULL
);

CREATE INDEX "fk_members_0_fi7imo" ON "members" ("preferred_space_id");

CREATE TABLE "memberships" (
  "id" INTEGER NOT NULL,
  "member_id" INTEGER NOT NULL,
  "plan_id" INTEGER NOT NULL,
  "starts_on" DATE NOT NULL,
  "ends_on" DATE,
  PRIMARY KEY ("id"),
  UNIQUE ("member_id", "starts_on"),
  CONSTRAINT "memberships_date_order" CHECK (ends_on IS NULL OR ends_on > starts_on),
  FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE RESTRICT,
  FOREIGN KEY ("plan_id") REFERENCES "plans" ("id") ON DELETE RESTRICT
);

CREATE INDEX "fk_memberships_1_1gk8tjy" ON "memberships" ("plan_id");

CREATE TABLE "amenities" (
  "id" INTEGER NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("name")
);

CREATE TABLE "space_amenities" (
  "space_id" INTEGER NOT NULL,
  "amenity_id" INTEGER NOT NULL,
  PRIMARY KEY ("space_id", "amenity_id"),
  FOREIGN KEY ("space_id") REFERENCES "spaces" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("amenity_id") REFERENCES "amenities" ("id") ON DELETE CASCADE
);

CREATE INDEX "fk_space_amenities_1_nxxwuh" ON "space_amenities" ("amenity_id");

CREATE TABLE "bookings" (
  "id" INTEGER NOT NULL,
  "member_id" INTEGER NOT NULL,
  "space_id" INTEGER NOT NULL,
  "starts_at" TIMESTAMP NOT NULL,
  "ends_at" TIMESTAMP NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "note" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "bookings_interval" CHECK (ends_at > starts_at),
  CONSTRAINT "bookings_status" CHECK (status IN ('confirmed', 'completed', 'cancelled')),
  FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE RESTRICT,
  FOREIGN KEY ("space_id") REFERENCES "spaces" ("id") ON DELETE RESTRICT
);

CREATE INDEX "bookings_availability_idx" ON "bookings" ("space_id", "starts_at", "ends_at");

CREATE INDEX "bookings_member_history_idx" ON "bookings" ("member_id", "starts_at");

CREATE TABLE "invoices" (
  "id" INTEGER NOT NULL,
  "member_id" INTEGER NOT NULL,
  "invoice_number" VARCHAR(40) NOT NULL,
  "issued_on" DATE NOT NULL,
  "due_on" DATE NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("invoice_number"),
  CONSTRAINT "invoices_amount" CHECK (amount >= 0),
  CONSTRAINT "invoices_dates" CHECK (due_on >= issued_on),
  CONSTRAINT "invoices_status" CHECK (status IN ('draft', 'paid', 'overdue')),
  FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE RESTRICT
);

CREATE INDEX "invoices_status_due_idx" ON "invoices" ("status", "due_on");

CREATE INDEX "fk_invoices_0_1vs3wex" ON "invoices" ("member_id");
