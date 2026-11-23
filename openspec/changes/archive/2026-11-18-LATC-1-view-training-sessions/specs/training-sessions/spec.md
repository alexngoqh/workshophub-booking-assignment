# Spec Delta

## Purpose

Lets employees browse the catalogue of internal training sessions so they can decide which ones to attend, through both the HTTP API and the web listing page.

## ADDED Requirements

### Requirement: List training sessions
The system SHALL return all training sessions from `GET /api/training-sessions` as a JSON array ordered by session date ascending, with HTTP 200.

#### Scenario: Sessions exist
- **WHEN** a client requests `GET /api/training-sessions`
- **THEN** the response is HTTP 200 with a JSON array
- **AND** each item includes id, title, description, date, capacity, registered, location, deliveryMode and status
- **AND** items are ordered by date ascending

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
