# Spec Delta

## ADDED Requirements

### Requirement: Cancel a registration
The system SHALL accept `DELETE /api/training-sessions/:id/registrations/:registrationId`, set the registration's status to `cancelled`, and respond HTTP 200 with `status: "cancelled"` and the updated session counts.

#### Scenario: Cancel a confirmed registration
- **WHEN** an employee cancels their confirmed registration
- **THEN** the response is HTTP 200 with `status: "cancelled"`
- **AND** the stored status is `cancelled` and the session's `registered` count is one lower

#### Scenario: Cancel a waitlisted registration
- **WHEN** an employee cancels a waitlisted registration
- **THEN** the response is HTTP 200, `registered` is unchanged and `waitlisted` is one lower

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
