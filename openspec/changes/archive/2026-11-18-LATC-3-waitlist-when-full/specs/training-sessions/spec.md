# Spec Delta

## MODIFIED Requirements

### Requirement: List training sessions
The system SHALL return all training sessions from `GET /api/training-sessions` as a JSON array ordered by session date ascending, with HTTP 200.

#### Scenario: Sessions exist
- **WHEN** a client requests `GET /api/training-sessions`
- **THEN** the response is HTTP 200 with a JSON array
- **AND** each item includes id, title, description, date, capacity, registered, waitlisted, location, deliveryMode and status
- **AND** items are ordered by date ascending

#### Scenario: Waitlisted count is separate
- **WHEN** a full session has 2 waitlisted registrations
- **THEN** its `registered` equals `capacity` and its `waitlisted` is 2
