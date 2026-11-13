# Equipment Lending Club Database

## Original brief

Design a database for a small equipment-lending club, operated by one librarian on a single offline workstation. Use three entities: members (id, full_name, unique email), items (id, unique asset_tag, name), and loans (id, member_id, item_id, borrowed_on, nullable returned_on). A member and an item each have many historical loans; every loan has one member and one item. No payments, bookings, authentication tables or locations. Store UTC dates. Keep loan history and RESTRICT deletion of referenced members/items. Require returned_on >= borrowed_on when present. Use SQLite. Seed at least three realistic rows per table with returned and open loans. The app, not a SQL CHECK, ensures at most one open loan per item. A library clerk is the only trusted user; protect the local file using OS permissions and backups. This is a wholly synthetic public test, not the course scenario.md.

## Initial understanding

A single-user offline SQLite database for a small equipment-lending club managed by one librarian. It tracks members (with unique email), items (with unique asset_tag), and loans (with borrowed_on and nullable returned_on UTC timestamps). Loan history is retained with RESTRICT deletion on referenced members and items. The application enforces at most one open loan per item; returned_on must be >= borrowed_on when present.

## Actors

- Library clerk (librarian)

## Candidate entities

- members (id, full_name, unique email)
- items (id, unique asset_tag, name)
- loans (id, member_id, item_id, borrowed_on, nullable returned_on)

## Main processes

- Borrowing an item (create a loan record)
- Returning an item (set returned_on)
- Viewing loan history for members and items
- Adding or editing members and items

## Questions and risks

- The 'at most one open loan per item' rule is enforced by the application, not the database, so a bug could create duplicate open loans.
- The returned_on >= borrowed_on requirement may be enforced by the application or a CHECK constraint; this is ambiguous.
- Single offline workstation creates a single point of failure; backup strategy is mentioned but not detailed.
- No authentication table; access control relies entirely on OS file permissions.
- Email and asset_tag uniqueness are enforced at the DB level but there is no verification that emails are valid or owned.
- RESTRICT deletion means loans cannot be deleted, which preserves history but may complicate corrections.
