# Spec Delta

## MODIFIED Requirements

### Requirement: Register from the session card
The web app SHALL let an employee register from a session card by entering name and email, show the banner "You're registered! [Session title] on [formatted date]", and update the card's count without reloading.

#### Scenario: Register in the UI
- **WHEN** an employee clicks Register, enters name and email and submits
- **THEN** the banner "You're registered! [Session title] on [formatted date]" is shown and the card reads one more registered

#### Scenario: Server rejects the registration
- **WHEN** the server responds with an error (for example a duplicate email)
- **THEN** the form stays open and shows the server's error message

### Requirement: Join the waitlist from the session card
The web app SHALL offer "Join Waitlist" on a full session card and, after joining, show the banner "You're on the waitlist for [Session title]. We'll let you know if a spot opens up." while the card shows the employee's waitlist position.

#### Scenario: Join waitlist in the UI
- **WHEN** an employee opens a full session's card, clicks "Join Waitlist" and submits name and email
- **THEN** the banner "You're on the waitlist for [Session title]. We'll let you know if a spot opens up." is shown
- **AND** the card shows "Your status: Waitlisted (position 1)", the registered count is unchanged and the card shows "1 on waitlist"

## ADDED Requirements

### Requirement: Banners can be dismissed
Registration banners SHALL appear without a page reload, SHALL have a Dismiss control, and SHALL disappear on their own after a few seconds.

#### Scenario: Dismiss
- **WHEN** the employee clicks Dismiss on a banner
- **THEN** the banner disappears

#### Scenario: Auto-dismiss
- **WHEN** the employee leaves the banner alone for several seconds
- **THEN** the banner disappears
