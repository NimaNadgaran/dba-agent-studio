# Lumina coworking

## Original brief

Design a database for Lumina, a coworking platform with 3 locations. Members subscribe to monthly plans and book meeting rooms or desks. Members can optionally select a preferred space. Spaces have shared amenities, capacities, and hourly rates. Track membership history, bookings (confirmed, completed, cancelled), and invoices. Support 5,000 members, 100,000 bookings per year, staff reporting and concurrent booking requests. Retain billing history and protect member contact details.

## Initial understanding

A multi-location coworking platform manages member profiles, plan subscriptions, bookable spaces, shared amenities, reservations, and billing history. Staff need occupancy and revenue reporting; members need safe concurrent booking and privacy boundaries.

## Actors

- Members booking workspaces
- Location staff managing spaces and bookings
- Billing administrators reviewing invoices

## Candidate entities

- Members: name, email, signup date
- Plans: monthly price and included hours
- Memberships: plan and effective dates
- Spaces: location, capacity, hourly rate
- Amenities and space-amenity links
- Bookings: member, space, time range, status
- Invoices: member, issue date, amount, payment state

## Main processes

- Register a member and enroll in a plan
- Search availability and reserve a workspace
- Cancel or complete a booking
- Issue invoices and report occupancy/revenue

## Questions and risks

- Overlapping reservations require transactional enforcement, not a row-level CHECK
- Billing retention and deletion policy need confirmation
- Clarify timezone and cancellation semantics
