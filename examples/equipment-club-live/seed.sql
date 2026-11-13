-- Meaningful sample data for Equipment Lending Club Database
-- Execute after schema.sql in the same empty database.
PRAGMA foreign_keys = ON;
BEGIN;

-- Club members with unique email and optional phone
INSERT INTO "members" ("id", "full_name", "email", "phone") VALUES
  (1, 'John Doe', 'john.doe@example.org', '+1-555-0100'),
  (2, 'Jane Smith', 'jane.smith@example.org', NULL),
  (3, 'Sam Brown', 'sam.brown@example.org', '+1-555-0123');

-- Lendable equipment items with unique asset tag
INSERT INTO "items" ("id", "asset_tag", "name") VALUES
  (1, 'CAM-001', 'Canon EOS R5 Camera'),
  (2, 'DRN-002', 'DJI Mavic 3 Drone'),
  (3, 'LAP-003', 'MacBook Pro 16-inch');

-- Loan records linking a member and an item with borrow and return dates
INSERT INTO "loans" ("id", "member_id", "item_id", "borrowed_on", "returned_on") VALUES
  (1, 1, 1, '2025-02-01', '2025-02-03'),
  (2, 2, 2, '2025-02-05', NULL),
  (3, 3, 3, '2025-02-07', NULL),
  (4, 1, 2, '2025-01-20', '2025-01-22');

COMMIT;
