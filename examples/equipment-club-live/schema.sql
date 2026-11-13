-- Equipment Lending Club Database
-- Target: SQLite. Run in a new, empty database.
-- IDs are explicitly supplied by the application; no identity/sequence allocation is assumed.

PRAGMA foreign_keys = ON;

CREATE TABLE "members" (
  "id" INTEGER NOT NULL,
  "full_name" TEXT NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(30),
  PRIMARY KEY ("id"),
  UNIQUE ("email"),
  CHECK (length("email") <= 255),
  CHECK (length("phone") <= 30)
);

CREATE TABLE "items" (
  "id" INTEGER NOT NULL,
  "asset_tag" VARCHAR(50) NOT NULL,
  "name" TEXT NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("asset_tag"),
  CHECK (length("asset_tag") <= 50)
);

CREATE TABLE "loans" (
  "id" INTEGER NOT NULL,
  "member_id" INTEGER NOT NULL,
  "item_id" INTEGER NOT NULL,
  "borrowed_on" DATE NOT NULL,
  "returned_on" DATE,
  PRIMARY KEY ("id"),
  CONSTRAINT "loans_return_check" CHECK (returned_on IS NULL OR returned_on >= borrowed_on),
  FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE RESTRICT,
  FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE RESTRICT
);

CREATE INDEX "loans_item_returned_idx" ON "loans" ("item_id", "returned_on");

CREATE INDEX "loans_member_idx" ON "loans" ("member_id");
