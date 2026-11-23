# registrations Specification

## Purpose
Lets employees secure a place on a training session by registering with their name and email, while guaranteeing that a session is never over-booked.

## Requirements

### Requirement: Register for a session
The system SHALL accept `POST /api/training-sessions/:id/registrations` with `name` and `email`. When a seat is free it SHALL create a `confirmed` registration, increment the session's `registered` count by 1, and respond HTTP 201 with the registration details (including `status: "confirmed"`) and the updated session counts.

#### Scenario: Successful registration
- **WHEN** an employee posts a valid name and email for a session with free seats
- **THEN** the response is HTTP 201 with id, sessionId, name, email and `status: "confirmed"`
- **AND** the session's `registered` count is one higher

### Requirement: Reject invalid registration input
The system SHALL respond HTTP 400 listing the problems when name or email is missing or blank, or the email is malformed.

#### Scenario: Missing fields
- **WHEN** the body is empty
- **THEN** the response is HTTP 400 with details "name is required" and "email is required"

#### Scenario: Malformed email
- **WHEN** the email is "not-an-email"
- **THEN** the response is HTTP 400

### Requirement: Unknown session
The system SHALL respond HTTP 404 when registering for a session that does not exist.

#### Scenario: Session missing
- **WHEN** an employee registers for session 999999
- **THEN** the response is HTTP 404

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

### Requirement: Register from the session card
The web app SHALL let an employee register from a session card by entering name and email, show the banner "You're registered! [Session title] on [formatted date]", and update the card's count without reloading.

#### Scenario: Register in the UI
- **WHEN** an employee clicks Register, enters name and email and submits
- **THEN** the banner "You're registered! [Session title] on [formatted date]" is shown and the card reads one more registered

#### Scenario: Server rejects the registration
- **WHEN** the server responds with an error (for example a duplicate email)
- **THEN** the form stays open and shows the server's error message

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
The web app SHALL offer "Join Waitlist" on a full session card and, after joining, show the banner "You're on the waitlist for [Session title]. We'll let you know if a spot opens up." while the card shows the employee's waitlist position.

#### Scenario: Join waitlist in the UI
- **WHEN** an employee opens a full session's card, clicks "Join Waitlist" and submits name and email
- **THEN** the banner "You're on the waitlist for [Session title]. We'll let you know if a spot opens up." is shown
- **AND** the card shows "Your status: Waitlisted (position 1)", the registered count is unchanged and the card shows "1 on waitlist"

### Requirement: Cancel a registration
The system SHALL accept `DELETE /api/training-sessions/:id/registrations/:registrationId`, set the registration's status to `cancelled`, and respond HTTP 200 with `status: "cancelled"`, `promotedRegistrationId` (the promoted registration's id, or `null`) and the updated session counts.

#### Scenario: Cancel a confirmed registration
- **WHEN** an employee cancels their confirmed registration and nobody is waitlisted
- **THEN** the response is HTTP 200 with `status: "cancelled"` and `promotedRegistrationId: null`
- **AND** the stored status is `cancelled` and the session's `registered` count is one lower

#### Scenario: Cancel a waitlisted registration
- **WHEN** an employee cancels a waitlisted registration
- **THEN** the response is HTTP 200 with `promotedRegistrationId: null`, `registered` is unchanged and `waitlisted` is one lower

### Requirement: Cancellation errors
The system SHALL respond HTTP 404 when the registration does not exist for that session and HTTP 409 when it is already cancelled, leaving counts unchanged.

#### Scenario: Unknown registration
- **WHEN** an employee cancels registration 999999
- **THEN** the response is HTTP 404

#### Scenario: Registration belongs to another session
- **WHEN** the registration id exists but under a different session id
- **THEN** the response is HTTP 404

#### Scenario: Already cancelled
- **WHEN** an employee cancels the same registration twice
- **THEN** the second response is HTTP 409 and `registered` is decremented only once

### Requirement: Re-register after cancelling
The system SHALL allow an email whose only registrations for a session are cancelled to register again.

#### Scenario: Register again
- **WHEN** an employee cancels and then registers again with the same email
- **THEN** the response is HTTP 201

### Requirement: Look up one registration
The system SHALL return a registration's id, name, email, status, createdAt and, when waitlisted, its position from `GET /api/training-sessions/:id/registrations/:registrationId`, or HTTP 404 when it does not exist for that session.

#### Scenario: Waitlisted lookup
- **WHEN** a client looks up a waitlisted registration
- **THEN** the response is HTTP 200 with `status: "waitlisted"` and its `position`

### Requirement: Cancel from the session card
The web app SHALL remember registrations made in the browser, show the employee's status on that session's card with a "Cancel Registration" button, ask for confirmation, and after cancelling show "Your registration has been cancelled", the updated count, and a disabled "Cancelled" button.

#### Scenario: Confirm and cancel
- **WHEN** an employee who registered in this browser clicks "Cancel Registration" and accepts "Are you sure you want to cancel your registration for [Session Title]?"
- **THEN** the card shows "Your registration has been cancelled", one fewer registered, and a disabled "Cancelled" button

#### Scenario: Dismiss the prompt
- **WHEN** the employee dismisses the confirmation prompt
- **THEN** nothing changes and the registration stays active

#### Scenario: Status survives a reload
- **WHEN** the employee reloads the page after registering
- **THEN** the card still shows their status and the "Cancel Registration" button

### Requirement: Promote the first waitlisted registration
When a confirmed registration is cancelled and the session has waitlisted registrations, the system SHALL change the earliest waitlisted registration to `confirmed` in the same transaction as the cancellation, leaving `registered` unchanged.

#### Scenario: Promotion happens
- **WHEN** a full session has waitlisted employees W1 then W2 and a confirmed employee cancels
- **THEN** W1's status becomes `confirmed` and the response has `promotedRegistrationId` equal to W1's id
- **AND** `registered` is unchanged, `waitlisted` is one lower, and W2 is now at position 1

#### Scenario: Atomic
- **WHEN** several confirmed employees cancel at the same time while employees are waitlisted
- **THEN** each cancellation promotes a different waitlisted employee and `registered` never exceeds `capacity`

### Requirement: Promoted employee sees confirmation
The web app SHALL show a promoted employee their status as "Confirmed" when they next load the sessions page, while the canceller sees only the standard cancellation message.

#### Scenario: Refresh after promotion
- **WHEN** a waitlisted employee reloads the page after someone else cancels
- **THEN** their card shows "Your status: Confirmed" and the registered count is unchanged

### Requirement: List registrations for a session
The system SHALL return `GET /api/training-sessions/:id/registrations` as HTTP 200 with separate `confirmed` and `waitlisted` arrays, each entry containing id, name, email, status and createdAt, in registration order, excluding cancelled registrations.

#### Scenario: Mixed registrations
- **WHEN** a session has 2 confirmed, 1 waitlisted and 1 cancelled registration
- **THEN** the response has 2 entries in `confirmed`, 1 in `waitlisted`, and the cancelled one in neither

#### Scenario: Unknown session
- **WHEN** an organiser requests registrations for session 999999
- **THEN** the response is HTTP 404

#### Scenario: No registrations
- **WHEN** a session has no registrations
- **THEN** the response is HTTP 200 with two empty arrays

### Requirement: Registrations section on the session detail page
The session detail page SHALL show a "Registrations" section with "Confirmed (N)" and "Waitlist (N)" subsections listing each registrant's name, email and registration date, and "No registrations yet" when both are empty. Cancelled registrations SHALL NOT be shown.

#### Scenario: Organiser sees attendees and waitlist
- **WHEN** an organiser opens the detail page of a full session with one waitlisted employee
- **THEN** the page shows "Confirmed (N)" with every confirmed registrant and "Waitlist (1)" with the waitlisted registrant's name, email and date

#### Scenario: Empty session
- **WHEN** an organiser opens the detail page of a session without registrations
- **THEN** the page shows "No registrations yet"

### Requirement: Reject registration after the deadline
The system SHALL respond HTTP 422 with `{ error: "Registration deadline has passed" }` to `POST /api/training-sessions/:id/registrations` when the server's current time is after the session's `registrationDeadline`, creating nothing and changing no counts. This applies whether the session has free seats or is full.

#### Scenario: Before the deadline
- **WHEN** an employee registers for a session whose deadline is in the future
- **THEN** the response is HTTP 201

#### Scenario: After the deadline
- **WHEN** an employee registers for a session whose deadline has passed
- **THEN** the response is HTTP 422 with error "Registration deadline has passed" and `registered` is unchanged

#### Scenario: Full session after the deadline
- **WHEN** an employee tries to join the waitlist of a full session whose deadline has passed
- **THEN** the response is HTTP 422 and no waitlisted registration is created

#### Scenario: No deadline
- **WHEN** an employee registers for a session without a deadline
- **THEN** the response is HTTP 201

### Requirement: Closed registration in the UI
The web app SHALL show "Registration closed" instead of the Register or Join Waitlist button when the deadline has passed, and SHALL show "Registration for this session has closed" in the form if the server rejects a submission because the deadline passed.

#### Scenario: Deadline passed
- **WHEN** an employee views a session whose deadline has passed
- **THEN** the card shows "Registration closed" and no Register or Join Waitlist button

#### Scenario: Deadline passes while the form is open
- **WHEN** an employee opened the form before the cutoff and submits after it
- **THEN** the form shows "Registration for this session has closed" and the count is unchanged

### Requirement: Banners can be dismissed
Registration banners SHALL appear without a page reload, SHALL have a Dismiss control, and SHALL disappear on their own after a few seconds.

#### Scenario: Dismiss
- **WHEN** the employee clicks Dismiss on a banner
- **THEN** the banner disappears

#### Scenario: Auto-dismiss
- **WHEN** the employee leaves the banner alone for several seconds
- **THEN** the banner disappears
