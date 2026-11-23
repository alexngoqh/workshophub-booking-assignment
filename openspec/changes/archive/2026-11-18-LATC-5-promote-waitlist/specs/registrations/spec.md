# Spec Delta

## MODIFIED Requirements

### Requirement: Cancel a registration
The system SHALL accept `DELETE /api/training-sessions/:id/registrations/:registrationId`, set the registration's status to `cancelled`, and respond HTTP 200 with `status: "cancelled"`, `promotedRegistrationId` (the promoted registration's id, or `null`) and the updated session counts.

#### Scenario: Cancel a confirmed registration
- **WHEN** an employee cancels their confirmed registration and nobody is waitlisted
- **THEN** the response is HTTP 200 with `status: "cancelled"` and `promotedRegistrationId: null`
- **AND** the stored status is `cancelled` and the session's `registered` count is one lower

#### Scenario: Cancel a waitlisted registration
- **WHEN** an employee cancels a waitlisted registration
- **THEN** the response is HTTP 200 with `promotedRegistrationId: null`, `registered` is unchanged and `waitlisted` is one lower

## ADDED Requirements

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
