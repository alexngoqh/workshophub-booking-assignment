# training-sessions Specification

## Purpose
Lets employees browse the catalogue of internal training sessions so they can decide which ones to attend, through both the HTTP API and the web listing page.

## Requirements

### Requirement: List training sessions
The system SHALL return all training sessions from `GET /api/training-sessions` as a JSON array ordered by session date ascending, with HTTP 200.

#### Scenario: Sessions exist
- **WHEN** a client requests `GET /api/training-sessions`
- **THEN** the response is HTTP 200 with a JSON array
- **AND** each item includes id, title, description, date, capacity, registered, waitlisted, registrationDeadline (date-time or null), location, deliveryMode and status
- **AND** items are ordered by date ascending

#### Scenario: Waitlisted count is separate
- **WHEN** a full session has 2 waitlisted registrations
- **THEN** its `registered` equals `capacity` and its `waitlisted` is 2

### Requirement: Fetch a single training session
The system SHALL return one session from `GET /api/training-sessions/:id`, HTTP 404 when it does not exist, and HTTP 400 when the id is not a number.

#### Scenario: Existing session
- **WHEN** a client requests `GET /api/training-sessions/:id` for an existing id
- **THEN** the response is HTTP 200 with that session

#### Scenario: Unknown session
- **WHEN** a client requests a session id that does not exist
- **THEN** the response is HTTP 404 with an `error` field

#### Scenario: Invalid id
- **WHEN** a client requests `GET /api/training-sessions/not-a-number`
- **THEN** the response is HTTP 400

### Requirement: Health check
The system SHALL expose `GET /health` returning HTTP 200 with `status: "ok"`.

#### Scenario: Service healthy
- **WHEN** a client requests `GET /health`
- **THEN** the response is HTTP 200 and the body contains `status: "ok"` and a timestamp

### Requirement: Session listing page
The web app SHALL show all sessions at `/`, each card displaying title, description, date and time, location, delivery mode and registered/capacity counts, in date order.

#### Scenario: Listing renders
- **WHEN** an employee opens `/`
- **THEN** every seeded session is shown as a card in date-ascending order
- **AND** each card shows the delivery mode badge, date, time, location and "N / M registered"

### Requirement: Listing loading and error states
The listing page SHALL show a loading message while fetching and an error message when the API request fails.

#### Scenario: API failure
- **WHEN** the sessions request fails
- **THEN** the page shows "Failed to load training sessions."

### Requirement: Session detail page
The web app SHALL serve a session detail page at `/sessions/:id` showing the session's title, date, time, location, delivery mode, capacity and full description, a link back to the listing, and a "Session not found" message for an unknown id. It SHALL be accessible without login.

#### Scenario: Open by URL
- **WHEN** a user opens `/sessions/:id` directly
- **THEN** the page shows that session's full details

#### Scenario: Unknown session page
- **WHEN** a user opens `/sessions/999999`
- **THEN** the page shows "Session not found" and a link back to all sessions

### Requirement: Navigate from a card to its detail page
Clicking a session card on the listing SHALL open that session's detail page, except when clicking a button, link or form field inside the card; browser back SHALL return to the listing.

#### Scenario: Click a card
- **WHEN** a user clicks a session card's title
- **THEN** the URL becomes `/sessions/:id` and the detail page is shown
- **AND** pressing back shows the listing again

#### Scenario: Buttons do not navigate
- **WHEN** a user clicks "Register" on a card
- **THEN** the registration form opens and the URL stays `/`

### Requirement: Show the registration deadline on the card
A session card SHALL show "Registration closes: [formatted date]" when the session has a deadline in the future, and no deadline label when the session has no deadline.

#### Scenario: Future deadline
- **WHEN** a session's deadline is in the future
- **THEN** its card shows "Registration closes:" followed by the formatted date and time, and the Register button

#### Scenario: No deadline
- **WHEN** a session has no deadline
- **THEN** its card shows no "Registration closes" or "Registration closed" text
