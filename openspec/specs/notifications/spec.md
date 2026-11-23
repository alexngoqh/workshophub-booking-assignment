# notifications Specification

## Purpose
Tells employees, through server-side notifications, when their seat on a training session is confirmed, either directly on registration or by promotion from the waitlist, without ever slowing down or failing the action itself.

## Requirements

### Requirement: Notify on confirmed registration
After a registration is confirmed and committed, the system SHALL emit a notification containing the employee's name and email, the session title and date, and `status: "confirmed"`.

#### Scenario: Confirmed registration
- **WHEN** an employee registers for a session with free seats
- **THEN** one notification is emitted with their name, email, the session title, the session date and status "confirmed"

#### Scenario: Waitlisted registration
- **WHEN** an employee is waitlisted
- **THEN** no notification is emitted

### Requirement: Notify on waitlist promotion
After a cancellation promotes a waitlisted employee and is committed, the system SHALL emit a notification for the promoted employee with `status: "promoted"`.

#### Scenario: Promotion
- **WHEN** a confirmed employee cancels and the first waitlisted employee is promoted
- **THEN** one notification is emitted for the promoted employee with status "promoted"

### Requirement: Notifications never affect the action
Notifications SHALL be sent after the response is decided and SHALL NOT delay or fail the registration or cancellation; delivery failures SHALL be logged and otherwise ignored.

#### Scenario: Transport failure
- **WHEN** the notification transport throws
- **THEN** the registration still returns HTTP 201 and is stored

### Requirement: Console and optional Slack delivery
The system SHALL log every notification to the server console, and SHALL also post it to Slack when `SLACK_WEBHOOK_URL` is set.

#### Scenario: Console log
- **WHEN** a notification is emitted
- **THEN** the server console shows a line with the status, name, email, session title and date

#### Scenario: Slack configured
- **WHEN** `SLACK_WEBHOOK_URL` is set and a notification is emitted
- **THEN** an HTTP POST with a JSON `text` message is sent to that URL
