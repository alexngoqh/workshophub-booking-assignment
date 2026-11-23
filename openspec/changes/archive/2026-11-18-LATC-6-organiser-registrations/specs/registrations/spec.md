# Spec Delta

## ADDED Requirements

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
