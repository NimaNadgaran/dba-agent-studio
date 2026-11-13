-- Meaningful sample data for Lumina coworking platform
-- Execute after schema.sql in the same empty database.
BEGIN;

-- Subscription products with stable pricing and included workspace hours.
INSERT INTO "plans" ("id", "name", "monthly_price", "included_hours") VALUES
  (1, 'Daylight', 99, 10),
  (2, 'Resident', 249, 40),
  (3, 'Studio', 499, 100);

-- Bookable rooms and desks, each with a location label, capacity and hourly rate.
INSERT INTO "spaces" ("id", "name", "location", "capacity", "hourly_rate") VALUES
  (1, 'The Greenhouse', 'Downtown', 8, 45),
  (2, 'Quiet Corner', 'Riverside', 1, 12.5),
  (3, 'Workshop Loft', 'Midtown', 16, 85);

-- Member identity, optional preferred space and contact information, separable from retained financial history.
INSERT INTO "members" ("id", "full_name", "email", "joined_on", "active", "preferred_space_id", "phone") VALUES
  (1, 'Maya Bennett', 'maya.bennett@example.org', '2026-01-14', TRUE, 1, '+1-202-555-0110'),
  (2, 'Omid Rahimi', 'omid.rahimi@example.org', '2026-02-03', TRUE, NULL, NULL),
  (3, 'Sofia Chen', 'sofia.chen@example.org', '2026-03-21', FALSE, 3, '+1-202-555-0112');

-- Effective-dated member subscriptions preserving plan enrollment history.
INSERT INTO "memberships" ("id", "member_id", "plan_id", "starts_on", "ends_on") VALUES
  (1, 1, 2, '2026-01-14', NULL),
  (2, 2, 1, '2026-02-03', NULL),
  (3, 3, 3, '2026-03-21', '2026-09-01');

-- Reusable amenity definitions shared by multiple bookable spaces.
INSERT INTO "amenities" ("id", "name") VALUES
  (1, '4K display'),
  (2, 'Whiteboard'),
  (3, 'Video conferencing');

-- Associative relation implementing the many-to-many space-to-amenity relationship.
INSERT INTO "space_amenities" ("space_id", "amenity_id") VALUES
  (1, 1),
  (1, 2),
  (2, 2),
  (3, 1),
  (3, 3);

-- UTC reservation intervals with lifecycle state and an optional member-supplied note.
INSERT INTO "bookings" ("id", "member_id", "space_id", "starts_at", "ends_at", "status", "note") VALUES
  (1, 1, 1, '2026-10-29 09:00:00', '2026-10-29 10:00:00', 'completed', 'Product planning with the design team'),
  (2, 2, 1, '2026-10-29 10:00:00', '2026-10-29 11:30:00', 'confirmed', NULL),
  (3, 3, 3, '2026-08-28 14:00:00', '2026-08-28 17:00:00', 'cancelled', 'Workshop moved to next month');

-- Retained member invoices independent of optional booking activity; no payment card data.
INSERT INTO "invoices" ("id", "member_id", "invoice_number", "issued_on", "due_on", "amount", "status") VALUES
  (1, 1, 'LUM-2026-1001', '2026-10-01', '2026-10-15', 249, 'paid'),
  (2, 2, 'LUM-2026-1002', '2026-10-01', '2026-10-15', 99, 'overdue'),
  (3, 3, 'LUM-2026-1003', '2026-10-29', '2026-11-12', 0, 'draft');

COMMIT;
