# Spec Delta

## ADDED Requirements

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
