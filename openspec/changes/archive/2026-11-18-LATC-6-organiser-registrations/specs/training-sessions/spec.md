# Spec Delta

## ADDED Requirements

### Requirement: Session detail page
The web app SHALL serve a session detail page at `/sessions/:id` showing the session's title, date, time, location, delivery mode, capacity and full description, a link back to the listing, and a "Session not found" message for an unknown id. It SHALL be accessible without login.

#### Scenario: Open by URL
- **WHEN** a user opens `/sessions/:id` directly
- **THEN** the page shows that session's full details

#### Scenario: Unknown session page
- **WHEN** a user opens `/sessions/999999`
- **THEN** the page shows "Session not found" and a link back to all sessions

### Requirement: Navigate from a card to its detail page
Clicking a session card on the listing SHALL open that session's detail page, except when clicking a button, link or form field inside the card; browser back SHALL return to the listing.

#### Scenario: Click a card
- **WHEN** a user clicks a session card's title
- **THEN** the URL becomes `/sessions/:id` and the detail page is shown
- **AND** pressing back shows the listing again

#### Scenario: Buttons do not navigate
- **WHEN** a user clicks "Register" on a card
- **THEN** the registration form opens and the URL stays `/`
