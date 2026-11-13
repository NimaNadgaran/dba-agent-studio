# Requirements — Equipment Lending Club Database

**Status:** Interview complete

## System brief

Design a database for a small equipment-lending club, operated by one librarian on a single offline workstation. Use three entities: members (id, full_name, unique email), items (id, unique asset_tag, name), and loans (id, member_id, item_id, borrowed_on, nullable returned_on). A member and an item each have many historical loans; every loan has one member and one item. No payments, bookings, authentication tables or locations. Store UTC dates. Keep loan history and RESTRICT deletion of referenced members/items. Require returned_on >= borrowed_on when present. Use SQLite. Seed at least three realistic rows per table with returned and open loans. The app, not a SQL CHECK, ensures at most one open loan per item. A library clerk is the only trusted user; protect the local file using OS permissions and backups. This is a wholly synthetic public test, not the course scenario.md.

## Consolidated requirements

Consolidated requirements: A single-user offline SQLite database for an equipment-lending club. Three entities: members (id INTEGER PRIMARY KEY, full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL), items (id INTEGER PRIMARY KEY, asset_tag TEXT UNIQUE NOT NULL, name TEXT NOT NULL), loans (id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL, item_id INTEGER NOT NULL, borrowed_on TEXT NOT NULL, returned_on TEXT NULL, FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT, FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT). Relationships: each loan has exactly one member and one item; members and items have zero-to-many historical loans. No limit on open loans per member; at most one open loan per item enforced by the application. returned_on must be >= borrowed_on when present, enforced by a CHECK constraint. Deletion of referenced members/items is RESTRICTED to preserve history. Dates stored as UTC ISO strings. IDs are integers assigned by the application. No concurrent users; application serializes writes. Security relies on OS file permissions and backups; emails are private contact data. Anticipated scale: ~100 members, 200 items, 2000 loans, ~200 new loans/year. Reads focus on overdue/open loans and member/item loan history; writes occasional. No payments, authentication, or extra entities. Seed at least three realistic rows per table with returned and open loans, ensuring no item has overlapping open loans.

## Interview round 1

### Entities & attributes

**Question:** Are there any additional attributes required for members, items, or loans beyond the listed fields?

**Answer:** Members have id, full_name, unique email. Items have id, unique asset_tag and name. Loans have id, member_id, item_id, borrowed_on and nullable returned_on. Every FK is mandatory, but return date is optional. Members/items have zero or many loans. Use integer IDs assigned by the app. Single trusted librarian, single offline workstation, SQLite, about 100 members, 200 items, 2000 loans with 200 new loans per year. Reads list overdue/open loans and historical member loans; writes are occasional. No concurrent users, no payments, no authentication or extra lookup tables. The application serializes writes and checks one open loan per item inside a transaction. Deletion is restricted, history retained, valid return dates checked in SQL. Dates are UTC ISO dates. Use OS file permissions and backups; emails are private contact data. Seed synthetic people and useful tools, returned and open loans, with no overlapping open loans for an item. No extra entities are needed. If ambiguity remains, use and document the simplest consistent assumption rather than inventing extra features.

### Relationships & cardinality

**Question:** Can a member have multiple open loans at the same time, and can an item be loaned to multiple members simultaneously?

**Answer:** Members have id, full_name, unique email. Items have id, unique asset_tag and name. Loans have id, member_id, item_id, borrowed_on and nullable returned_on. Every FK is mandatory, but return date is optional. Members/items have zero or many loans. Use integer IDs assigned by the app. Single trusted librarian, single offline workstation, SQLite, about 100 members, 200 items, 2000 loans with 200 new loans per year. Reads list overdue/open loans and historical member loans; writes are occasional. No concurrent users, no payments, no authentication or extra lookup tables. The application serializes writes and checks one open loan per item inside a transaction. Deletion is restricted, history retained, valid return dates checked in SQL. Dates are UTC ISO dates. Use OS file permissions and backups; emails are private contact data. Seed synthetic people and useful tools, returned and open loans, with no overlapping open loans for an item. No extra entities are needed. If ambiguity remains, use and document the simplest consistent assumption rather than inventing extra features.

### Volume & growth

**Question:** What is the anticipated number of members, items, and loan records over the next 12 months?

**Answer:** Members have id, full_name, unique email. Items have id, unique asset_tag and name. Loans have id, member_id, item_id, borrowed_on and nullable returned_on. Every FK is mandatory, but return date is optional. Members/items have zero or many loans. Use integer IDs assigned by the app. Single trusted librarian, single offline workstation, SQLite, about 100 members, 200 items, 2000 loans with 200 new loans per year. Reads list overdue/open loans and historical member loans; writes are occasional. No concurrent users, no payments, no authentication or extra lookup tables. The application serializes writes and checks one open loan per item inside a transaction. Deletion is restricted, history retained, valid return dates checked in SQL. Dates are UTC ISO dates. Use OS file permissions and backups; emails are private contact data. Seed synthetic people and useful tools, returned and open loans, with no overlapping open loans for an item. No extra entities are needed. If ambiguity remains, use and document the simplest consistent assumption rather than inventing extra features.

### Queries & reporting

**Question:** Which reports or queries will be frequently run, such as overdue loans, member activity, or item utilization?

**Answer:** Members have id, full_name, unique email. Items have id, unique asset_tag and name. Loans have id, member_id, item_id, borrowed_on and nullable returned_on. Every FK is mandatory, but return date is optional. Members/items have zero or many loans. Use integer IDs assigned by the app. Single trusted librarian, single offline workstation, SQLite, about 100 members, 200 items, 2000 loans with 200 new loans per year. Reads list overdue/open loans and historical member loans; writes are occasional. No concurrent users, no payments, no authentication or extra lookup tables. The application serializes writes and checks one open loan per item inside a transaction. Deletion is restricted, history retained, valid return dates checked in SQL. Dates are UTC ISO dates. Use OS file permissions and backups; emails are private contact data. Seed synthetic people and useful tools, returned and open loans, with no overlapping open loans for an item. No extra entities are needed. If ambiguity remains, use and document the simplest consistent assumption rather than inventing extra features.

### Transactions & concurrency

**Question:** Will the database be accessed by multiple users or processes concurrently, or is it strictly single-user offline?

**Answer:** Members have id, full_name, unique email. Items have id, unique asset_tag and name. Loans have id, member_id, item_id, borrowed_on and nullable returned_on. Every FK is mandatory, but return date is optional. Members/items have zero or many loans. Use integer IDs assigned by the app. Single trusted librarian, single offline workstation, SQLite, about 100 members, 200 items, 2000 loans with 200 new loans per year. Reads list overdue/open loans and historical member loans; writes are occasional. No concurrent users, no payments, no authentication or extra lookup tables. The application serializes writes and checks one open loan per item inside a transaction. Deletion is restricted, history retained, valid return dates checked in SQL. Dates are UTC ISO dates. Use OS file permissions and backups; emails are private contact data. Seed synthetic people and useful tools, returned and open loans, with no overlapping open loans for an item. No extra entities are needed. If ambiguity remains, use and document the simplest consistent assumption rather than inventing extra features.

### Security & privacy

**Question:** What additional security measures are expected beyond OS file permissions, such as encryption, access logging, or backup retention?

**Answer:** Members have id, full_name, unique email. Items have id, unique asset_tag and name. Loans have id, member_id, item_id, borrowed_on and nullable returned_on. Every FK is mandatory, but return date is optional. Members/items have zero or many loans. Use integer IDs assigned by the app. Single trusted librarian, single offline workstation, SQLite, about 100 members, 200 items, 2000 loans with 200 new loans per year. Reads list overdue/open loans and historical member loans; writes are occasional. No concurrent users, no payments, no authentication or extra lookup tables. The application serializes writes and checks one open loan per item inside a transaction. Deletion is restricted, history retained, valid return dates checked in SQL. Dates are UTC ISO dates. Use OS file permissions and backups; emails are private contact data. Seed synthetic people and useful tools, returned and open loans, with no overlapping open loans for an item. No extra entities are needed. If ambiguity remains, use and document the simplest consistent assumption rather than inventing extra features.

### Business rules

**Question:** Are there any rules regarding loan duration, renewal, or overdue fines that need to be enforced?

**Answer:** Members have id, full_name, unique email. Items have id, unique asset_tag and name. Loans have id, member_id, item_id, borrowed_on and nullable returned_on. Every FK is mandatory, but return date is optional. Members/items have zero or many loans. Use integer IDs assigned by the app. Single trusted librarian, single offline workstation, SQLite, about 100 members, 200 items, 2000 loans with 200 new loans per year. Reads list overdue/open loans and historical member loans; writes are occasional. No concurrent users, no payments, no authentication or extra lookup tables. The application serializes writes and checks one open loan per item inside a transaction. Deletion is restricted, history retained, valid return dates checked in SQL. Dates are UTC ISO dates. Use OS file permissions and backups; emails are private contact data. Seed synthetic people and useful tools, returned and open loans, with no overlapping open loans for an item. No extra entities are needed. If ambiguity remains, use and document the simplest consistent assumption rather than inventing extra features.



## Interview round 2

### Relationships & cardinality

**Question:** The original question about whether a member can have multiple open loans was not explicitly answered. Can a single member have multiple open loans simultaneously, or is there a limit (e.g., at most one open loan per member)?

**Answer:** Members have id, full_name, unique email. Items have id, unique asset_tag and name. Loans have id, member_id, item_id, borrowed_on and nullable returned_on. Every FK is mandatory, but return date is optional. Members/items have zero or many loans. Use integer IDs assigned by the app. Single trusted librarian, single offline workstation, SQLite, about 100 members, 200 items, 2000 loans with 200 new loans per year. Reads list overdue/open loans and historical member loans; writes are occasional. No concurrent users, no payments, no authentication or extra lookup tables. The application serializes writes and checks one open loan per item inside a transaction. Deletion is restricted, history retained, valid return dates checked in SQL. Dates are UTC ISO dates. Use OS file permissions and backups; emails are private contact data. Seed synthetic people and useful tools, returned and open loans, with no overlapping open loans for an item. No extra entities are needed. If ambiguity remains, use and document the simplest consistent assumption rather than inventing extra features.

### Business rules

**Question:** The answers mention 'valid return dates checked in SQL' and 'The application ... checks one open loan per item inside a transaction.' Should the returned_on >= borrowed_on rule be implemented as a SQL CHECK constraint, and should the one-open-loan-per-item rule be enforced solely by the application, or would a database trigger or partial unique index be acceptable?

**Answer:** Members have id, full_name, unique email. Items have id, unique asset_tag and name. Loans have id, member_id, item_id, borrowed_on and nullable returned_on. Every FK is mandatory, but return date is optional. Members/items have zero or many loans. Use integer IDs assigned by the app. Single trusted librarian, single offline workstation, SQLite, about 100 members, 200 items, 2000 loans with 200 new loans per year. Reads list overdue/open loans and historical member loans; writes are occasional. No concurrent users, no payments, no authentication or extra lookup tables. The application serializes writes and checks one open loan per item inside a transaction. Deletion is restricted, history retained, valid return dates checked in SQL. Dates are UTC ISO dates. Use OS file permissions and backups; emails are private contact data. Seed synthetic people and useful tools, returned and open loans, with no overlapping open loans for an item. No extra entities are needed. If ambiguity remains, use and document the simplest consistent assumption rather than inventing extra features.

### Volume & growth

**Question:** The brief asks for 'at least three realistic rows per table,' but the answers describe a system with ~100 members and 200 items. Should the seed script create a minimal dataset (e.g., 3 members, 3 items, 3 loans) or a larger representative subset (e.g., 20 members, 30 items, 50 loans) to demonstrate the queries?

**Answer:** Members have id, full_name, unique email. Items have id, unique asset_tag and name. Loans have id, member_id, item_id, borrowed_on and nullable returned_on. Every FK is mandatory, but return date is optional. Members/items have zero or many loans. Use integer IDs assigned by the app. Single trusted librarian, single offline workstation, SQLite, about 100 members, 200 items, 2000 loans with 200 new loans per year. Reads list overdue/open loans and historical member loans; writes are occasional. No concurrent users, no payments, no authentication or extra lookup tables. The application serializes writes and checks one open loan per item inside a transaction. Deletion is restricted, history retained, valid return dates checked in SQL. Dates are UTC ISO dates. Use OS file permissions and backups; emails are private contact data. Seed synthetic people and useful tools, returned and open loans, with no overlapping open loans for an item. No extra entities are needed. If ambiguity remains, use and document the simplest consistent assumption rather than inventing extra features.



## Interview decision

The brief and subsequent answers provide sufficient detail to design the schema. The entities, attributes, relationships, constraints, and seed requirements are clearly specified. Ambiguities about member open loan limit and enforcement mechanisms can be resolved with reasonable assumptions: no limit on member open loans, and use a CHECK constraint for returned_on >= borrowed_on while the application enforces the one open loan per item rule. The seed scope is met with at least three rows per table.

## Outstanding questions

- None identified.

## Current requirements after revisions

The original brief and interview above are preserved as history. The following later user requests supersede conflicting earlier requirements. Read these together with the current design.json.

### v2: Add an optional phone string to members, length 30. Include populated and NULL phone sample values, update privacy and normalization notes, and preserve all other requirements and SQLite.

Added an optional phone column (string, length 30) to the members table, updated sample rows to include populated and NULL values, and revised normalization and privacy notes accordingly. All other constraints and tables remain unchanged.

### v3: Correct two review findings. The original brief explicitly requested date-only borrowed_on and returned_on: change both to abstract date, with YYYY-MM-DD seed values, not timestamps. Correct the contradictory email assumption: the database enforces email uniqueness through UNIQUE, while email format validation belongs to the application. Preserve all three entities, keys, constraints, loan history, optional phone string length 30, populated and NULL phone samples, and SQLite. Document these review corrections.

Review corrections applied: borrowed_on and returned_on in the loans table were changed from timestamp to date (UTC, YYYY-MM-DD) with date-only seed values, matching the original brief. The email assumption was corrected so the database enforces uniqueness via the UNIQUE constraint while email format validation remains an application responsibility. All other entities, keys, constraints, loan history, optional phone string (length 30) with populated and NULL samples, RESTRICT deletion, and SQLite remain unchanged. Dependencies updated accordingly: assumptions, column descriptions, and loan sample rows.

### Current business rules

- At most one open loan per item: enforced by the application within a transaction (not by a SQL constraint).
- returned_on must be >= borrowed_on when present: enforced by the SQL CHECK constraint loans_return_check.
- Email must be unique: enforced by the UNIQUE constraint on members.email.
- Asset tag must be unique: enforced by the UNIQUE constraint on items.asset_tag.
- Deletion of a member or item that has existing loans is restricted: enforced by ON DELETE RESTRICT on foreign keys.
- Loan history is retained indefinitely; no cascading deletes.
- All foreign keys (member_id, item_id) are mandatory and must reference existing rows.
