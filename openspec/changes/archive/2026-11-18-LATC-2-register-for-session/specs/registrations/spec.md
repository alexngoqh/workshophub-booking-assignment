# Spec Delta

## Purpose

Lets employees secure a place on a training session by registering with their name and email, while guaranteeing that a session is never over-booked.

## ADDED Requirements

### Requirement: Register for a session
The system SHALL accept `POST /api/training-sessions/:id/registrations` with `name` and `email`, create a registration, increment the session's `registered` count by 1, and respond HTTP 201 with the registration details and the updated session counts.

#### Scenario: Successful registration
- **WHEN** an employee posts a valid name and email for a session with free seats
- **THEN** the response is HTTP 201 with id, sessionId, name and email
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

### Requirement: Full session rejects registration
The system SHALL respond HTTP 409 and leave counts unchanged when `registered >= capacity`.

#### Scenario: Session full
- **WHEN** a session with capacity 1 already has 1 registration and another employee registers
- **THEN** the response is HTTP 409 and `registered` stays 1

### Requirement: Prevent duplicate registration
The system SHALL respond HTTP 409 when the same email (case-insensitive, trimmed) is already registered for the session, without changing counts.

#### Scenario: Same email twice
- **WHEN** "ada@example.com" registers and then "ADA@example.com " registers for the same session
- **THEN** the second response is HTTP 409 with an "already registered" error and `registered` is 1

### Requirement: No over-booking under concurrency
The system SHALL never let `registered` exceed `capacity`, even when requests arrive concurrently.

#### Scenario: Concurrent requests
- **WHEN** 8 different employees register at the same time for a session with capacity 3
- **THEN** exactly 3 receive HTTP 201 and `registered` is 3

### Requirement: Register from the session card
The web app SHALL let an employee register from a session card by entering name and email, show a confirmation, and update the card's count without reloading.

#### Scenario: Register in the UI
- **WHEN** an employee clicks Register, enters name and email and submits
- **THEN** a confirmation message is shown and the card reads one more registered

#### Scenario: Server rejects the registration
- **WHEN** the server responds with an error (for example a duplicate email)
- **THEN** the form stays open and shows the server's error message

### Requirement: Full session cannot be registered from the UI
The web app SHALL disable the Register button when `registered >= capacity`.

#### Scenario: Full card
- **WHEN** a session card is full
- **THEN** its Register button is disabled
