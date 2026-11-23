# registration-audit Specification

## Purpose
Keeps an immutable, chronological record of every status change of every registration so organisers can trace a registration's full lifecycle for reporting or dispute resolution.

## Requirements

### Requirement: Record every registration state change
The system SHALL write one audit entry (registrationId, fromStatus, toStatus, changedAt, reason) for every registration status change, in the same transaction as the change, so a change is never stored without its entry or vice versa.

#### Scenario: Registered
- **WHEN** an employee registers and is confirmed
- **THEN** an entry with fromStatus null, toStatus "confirmed" and reason "registered" exists

#### Scenario: Waitlisted
- **WHEN** an employee registers for a full session
- **THEN** an entry with fromStatus null, toStatus "waitlisted" and reason "waitlisted" exists

#### Scenario: Promoted
- **WHEN** a waitlisted employee is promoted after a cancellation
- **THEN** an entry with fromStatus "waitlisted", toStatus "confirmed" and reason "promoted" exists for that employee's registration

#### Scenario: Cancelled
- **WHEN** a confirmed employee cancels
- **THEN** an entry with fromStatus "confirmed", toStatus "cancelled" and reason "cancelled" exists

#### Scenario: Rejected requests leave no entry
- **WHEN** a registration request is rejected (duplicate, deadline passed) or a cancellation is rejected (already cancelled)
- **THEN** no audit entry is written

### Requirement: Query a registration's audit history
The system SHALL return `GET /api/training-sessions/:id/registrations/:registrationId/audit` as HTTP 200 with the registration's entries in chronological order, HTTP 404 when the registration does not exist for that session, and HTTP 400 for non-numeric ids.

#### Scenario: Full lifecycle
- **WHEN** an employee is waitlisted, promoted and later cancels, and the organiser queries the audit
- **THEN** the response lists null→waitlisted, waitlisted→confirmed, confirmed→cancelled in that order

#### Scenario: Unknown registration
- **WHEN** the organiser queries the audit of registration 999999
- **THEN** the response is HTTP 404

### Requirement: Audit entries are immutable
The API SHALL NOT offer any way to create, modify or delete audit entries directly.

#### Scenario: Modification attempt
- **WHEN** a client sends PUT, PATCH or DELETE to the audit URL
- **THEN** the request is rejected and the entries are unchanged

### Requirement: Registration ids visible to organisers
The session detail page SHALL show each registration's id so the organiser can query its audit history.

#### Scenario: Find the id
- **WHEN** an organiser opens a session's detail page with registrations
- **THEN** each confirmed and waitlisted row shows its registration id
