# Spec Delta

## MODIFIED Requirements

### Requirement: Register for a session
The system SHALL accept `POST /api/training-sessions/:id/registrations` with `name` and `email`. When a seat is free it SHALL create a `confirmed` registration, increment the session's `registered` count by 1, and respond HTTP 201 with the registration details (including `status: "confirmed"`) and the updated session counts.

#### Scenario: Successful registration
- **WHEN** an employee posts a valid name and email for a session with free seats
- **THEN** the response is HTTP 201 with id, sessionId, name, email and `status: "confirmed"`
- **AND** the session's `registered` count is one higher

### Requirement: Prevent duplicate registration
The system SHALL respond HTTP 409 when the same email (case-insensitive, trimmed) already has an active (confirmed or waitlisted) registration for the session, without changing counts.

#### Scenario: Same email twice
- **WHEN** "ada@example.com" registers and then "ADA@example.com " registers for the same session
- **THEN** the second response is HTTP 409 with an "already registered" error and `registered` is 1

#### Scenario: Already on the waitlist
- **WHEN** an email that is waitlisted for a full session registers again
- **THEN** the response is HTTP 409 and the waitlist is unchanged

### Requirement: No over-booking under concurrency
The system SHALL never let `registered` exceed `capacity`, even when requests arrive concurrently; requests that do not get a seat SHALL be waitlisted.

#### Scenario: Concurrent requests
- **WHEN** 8 different employees register at the same time for a session with capacity 3
- **THEN** exactly 3 receive HTTP 201, 5 receive HTTP 202, and `registered` is 3
- **AND** the waitlist positions are 1 to 5 with no gaps or repeats

## REMOVED Requirements

### Requirement: Full session rejects registration
**Reason**: Replaced by waitlisting; a full session no longer turns employees away.
**Migration**: Clients must treat HTTP 202 with `status: "waitlisted"` as the full-session outcome instead of HTTP 409.

### Requirement: Full session cannot be registered from the UI
**Reason**: A full session now offers "Join Waitlist".
**Migration**: None; the button label and action change.

## ADDED Requirements

### Requirement: Waitlist when full
When `registered >= capacity`, the system SHALL create a `waitlisted` registration, leave `registered` unchanged, and respond HTTP 202 with `status: "waitlisted"` and the employee's 1-based waitlist `position`.

#### Scenario: First on the waitlist
- **WHEN** a session with capacity 1 already has 1 confirmed registration and another employee registers
- **THEN** the response is HTTP 202 with `status: "waitlisted"` and `position: 1`
- **AND** `registered` stays 1

#### Scenario: Positions are ordered
- **WHEN** three employees join the waitlist of a full session one after another
- **THEN** they receive positions 1, 2 and 3

### Requirement: Join the waitlist from the session card
The web app SHALL offer "Join Waitlist" on a full session card and, after joining, show a message that the employee is waitlisted (not confirmed) with their position.

#### Scenario: Join waitlist in the UI
- **WHEN** an employee opens a full session's card, clicks "Join Waitlist" and submits name and email
- **THEN** the card shows "You're on the waitlist (position 1). Your place is not confirmed yet."
- **AND** the registered count is unchanged and the card shows "1 on waitlist"
