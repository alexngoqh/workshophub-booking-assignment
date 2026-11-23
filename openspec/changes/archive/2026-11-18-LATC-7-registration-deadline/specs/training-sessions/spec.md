# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Show the registration deadline on the card
A session card SHALL show "Registration closes: [formatted date]" when the session has a deadline in the future, and no deadline label when the session has no deadline.

#### Scenario: Future deadline
- **WHEN** a session's deadline is in the future
- **THEN** its card shows "Registration closes:" followed by the formatted date and time, and the Register button

#### Scenario: No deadline
- **WHEN** a session has no deadline
- **THEN** its card shows no "Registration closes" or "Registration closed" text
