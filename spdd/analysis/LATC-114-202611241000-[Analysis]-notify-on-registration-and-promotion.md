# SPDD Analysis: Notify on Registration and Waitlist Promotion (LATC-114)

> Story card: **LATC-114** "Send notification after registration or waitlist promotion — Alex Ngo" (team copy of **LATC-8**). Branch `latc-114-notify-on-confirm`, based on `main` at `0d2e73b`.
> **Headline:** `main` already implements LATC-8. This analysis is a **gap check** of the existing implementation against every AC, not a greenfield design.

## Original Business Requirement

_Migrated from WH-8_ (copied from LATC-8 for Alex Ngo)

### Context

Employees should receive feedback when they successfully register or are promoted from the waitlist. This confirmation helps them know their seat is secured without needing to check back.

This is a **trainee exercise story**. It is not implemented in the baseline template.

### Description

As an employee, I want to receive a notification when I register or am promoted from the waitlist so that I know my seat is confirmed.

For training simplicity, the in-app UI shows a success banner immediately after the action. A backend notification (console log or Slack webhook) fires as a side effect and does not block the response.

### Acceptance Criteria

**User interactions (in-app feedback):**

- After successfully registering (confirmed), the page shows a success banner: "You're registered! \[Session title\] on \[formatted date\]"
- After joining the waitlist, the page shows: "You're on the waitlist for \[Session title\]. We'll let you know if a spot opens up."
- Both banners appear immediately after the form is submitted without a page reload
- The banners can be dismissed by the user or auto-dismiss after a few seconds
- If the backend notification fails, the banner still appears (notification failure is silent)

**Backend notification:**

- After a successful registration (`confirmed`), a notification event is emitted on the server
- After a waitlist promotion (`confirmed` via WH-5), a notification event is emitted on the server
- The notification includes: employee name, email, session title, session date, status (`confirmed` or `promoted`)
- For baseline: notification is logged to the server console
- Optional extension: if `SLACK_WEBHOOK_URL` is set in the environment, a Slack message is sent to the configured channel
- Notification failures must not fail the registration or promotion (fire-and-forget)

### Out of Scope

- Real email delivery
- SMS notifications
- Notification for cancellation
- Notification history or inbox

### Suggested Tests

- Registration success → success banner shown in UI
- Waitlist registration → waitlist banner shown in UI
- Registration success → notification logged with correct employee and session details
- Waitlist promotion → notification logged
- Notification failure does not affect API response
- Slack notification sent when `SLACK_WEBHOOK_URL` is set (optional, integration test)

### Implementation Hint

Use an event emitter or a simple async side-effect function. The core registration path should not `await` the notification.

---

## Domain Concept Identification

**Codebase state (grounded, `main` @ `0d2e73b`):**

- **Backend:** `api/src/notifications/index.ts` defines a notification event, a console transport, an optional Slack-webhook transport (enabled by `SLACK_WEBHOOK_URL`), and a fire-and-forget `notify()` that tracks in-flight deliveries and logs and swallows failures.
- **Call sites:** `registrationService` calls `notify` **after** the transaction commits: on a confirmed registration (status `confirmed`) and on a promotion during cancellation (status `promoted`). Waitlisting and a cancellation without promotion do not notify.
- **Frontend:** `app/src/banner.ts` is a small publish/subscribe channel. `components/Banner.tsx` is mounted once in `App.tsx`, shows the latest message, can be dismissed, and auto-dismisses after 6 s. `RegistrationPanel` raises the exact AC texts on 201 and 202, using `formatDate` (`en-SG` long date).
- **Tests:** unit (`tests/unit/notifications.test.ts`, 6 cases: format, async delivery, failure swallowing, Slack payload, Slack only when the env var is set), integration (`tests/integration/notifications.test.ts`, 5 cases: confirmed, waitlisted-not-notified, promoted, no-promotion-not-notified, failing transport), E2E (`e2e/tests/latc-8-notifications.spec.ts`, 5 cases: both banners, dismiss, auto-dismiss, failed backend notification). The canonical spec is `openspec/specs/notifications/spec.md`.

### Existing Concepts (from codebase)

- **Registration notification event**: what happened (`confirmed` / `promoted`), to whom (name, email) and for which session (title, date). Built from the committed registration and session counts.
- **Transport**: a delivery channel for an event. Console is always on; Slack is opt-in through the environment. Several transports receive the same event independently.
- **Fire-and-forget delivery**: the caller never waits and never sees an error. In-flight deliveries are tracked only so tests can flush them.
- **Banner message**: app-level, transient UI feedback raised by any component and shown by one `Banner` host.
- **Registration outcome** (LATC-2/3/5): `confirmed` (201), `waitlisted` (202), and promotion as a side effect of cancellation. It drives both which event and which banner.

### New Concepts Required

- **None for the ACs.** Every AC maps to an existing concept.
- **Delivery deadline (hardening, optional):** a bound on how long one transport delivery may take. Today a hanging Slack endpoint keeps a delivery pending forever. That's harmless to responses, but it leaks one in-flight entry and would hang `flushNotifications()` in tests.

### Key Business Rules

- **Notify only on confirmed seats:** confirmed registration and promotion notify; waitlisting and cancellation do not. _(event, outcome)_
- **After commit, never before:** a rolled-back transaction must never produce a notification. _(event, transaction)_
- **Never affects the outcome:** transport failure or latency must not change the HTTP status or body, or delay the response. _(fire-and-forget)_
- **Banner text is fixed by the AC:** both strings are exact, with the date formatted for humans. _(banner)_
- **Implicit, privacy:** the Slack message contains the employee's email and goes to an external service. _(transport)_

---

## Strategic Approach

### Solution Direction

- **No new feature work.** Accept the existing implementation as satisfying LATC-114 and trace each AC to code and to a test (see the coverage table).
- If the team wants deliverable code from this story, keep it to **hardening the existing notification module**, using the same patterns (transport functions, `notify` stays synchronous for callers, failures logged and swallowed). Don't redesign it.
- Any change goes through `/tdd` one slice at a time, with unit tests in `tests/unit/notifications.test.ts`.

### Key Design Decisions

- **N1 · Rebuild vs accept:** rebuilding duplicates tested code and risks regressions in E2E. Accepting costs nothing. → **Accept**, and close the story with the traceability evidence.
- **N2 · Slack delivery deadline (optional hardening):**
  - No deadline means a stuck endpoint keeps a pending delivery forever, and `flushNotifications` can hang a test run.
  - A short per-delivery deadline (a few seconds) ends that, and the existing catch logs it like any other failure.
  - → **Recommend adding a deadline** if the team takes one slice of work from this story. It's small, testable, and within the existing design.
- **N3 · Human-readable date in the server message:** the console and Slack text use an ISO timestamp, while the banner uses a long local date. The AC only says "includes session date", so ISO satisfies it. → **Leave as is** unless the team wants friendlier Slack text (cosmetic, out of AC).
- **N4 · Email in Slack text:** the AC requires email in the notification, so this isn't a defect. → **Flag only.** Masking would contradict the AC.

### Alternatives Considered

- **Event emitter (Node `EventEmitter`) instead of `notify()`:** the hint allows either. The existing function-based design is simpler, fully tested, and already fire-and-forget. A rewrite is not justified.
- **Queue or outbox for guaranteed delivery:** this would survive restarts, but it's out of scope (no notification history, no real email) and a large change for a training story.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **"Formatted date"** in the banner: the implementation uses the `en-SG` long date (e.g. "Thursday, 1 January 2099"). It's consistent with the cards, but the AC doesn't fix a format.
- **"Auto-dismiss after a few seconds":** 6 s today. Acceptable, but not pinned by the AC.
- **"Status (`confirmed` or `promoted`)":** the implementation emits `promoted` for promotions, matching the AC. The AC text "(`confirmed` via WH-5)" could also be read as status `confirmed`, but the explicit list wins.
- **Banner for the promoted employee:** the promoted person gets no in-app banner. They see "Confirmed" on reload (LATC-5), and "promotion notification UI" is out of scope in LATC-5. This should be confirmed as intended.

### Edge Cases

- **Hanging Slack webhook:** the delivery never settles, so `pending` grows and `flushNotifications()` never resolves (N2).
- **Process shutdown with deliveries in flight:** those notifications are lost. Accepted under fire-and-forget, with no history in scope.
- **Two banners in quick succession** (e.g. two cards): only the latest is shown, since the host keeps a single message. Acceptable, and not covered by an AC.
- **Concurrent cancels promoting two people:** two `promoted` events, one per promoted registration. This is already guaranteed by the single-promotion-per-cancel transaction.

### Technical Risks

- **Test hang risk** from N2 in any future test that uses a real or slow Slack transport. The current tests stub the transport, so the risk is latent.
- **External call from a request-serving process:** if Slack is slow, Node keeps sockets open. It's bounded by N2 if adopted.
- **Spec drift:** `openspec/specs/notifications/spec.md` is the canonical behaviour. Any hardening should update it in the same change.

### Acceptance Criteria Coverage

| AC# | Description                                                         | Addressable?      | Gaps/Notes                                                                                |
| --- | ------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| 1   | Confirmed → "You're registered! [title] on [formatted date]" banner | Yes (implemented) | `RegistrationPanel.handleRegistered` + `formatDate`; E2E "shows the registered banner…"   |
| 2   | Waitlisted → exact waitlist banner text                             | Yes (implemented) | Same handler; E2E "shows the waitlist banner…"                                            |
| 3   | Banners appear without page reload                                  | Yes (implemented) | Pub/sub `showBanner` → `Banner` host; asserted in E2E 1                                   |
| 4   | Dismissible or auto-dismiss                                         | Yes (implemented) | × button + 6 s timer; E2E "dismissed", "auto-dismisses"                                   |
| 5   | Backend failure → banner still appears                              | Yes (implemented) | Banner is client-side from the 201/202; E2E "failed backend notification…"                |
| 6   | Confirmed registration emits a server event                         | Yes (implemented) | `notify(…'confirmed')` after commit; integration test 1                                   |
| 7   | Promotion emits a server event                                      | Yes (implemented) | `notify(…'promoted')` after commit in cancel; integration test 3                          |
| 8   | Event has name, email, title, date, status                          | Yes (implemented) | `RegistrationNotification`; unit test 1 + integration test 1                              |
| 9   | Logged to the server console                                        | Yes (implemented) | `consoleTransport`; unit test 1                                                           |
| 10  | Optional Slack when `SLACK_WEBHOOK_URL` is set                      | Yes (implemented) | `slackTransport`; unit tests "posts…" and "uses Slack only when…"                         |
| 11  | Failures never fail registration or promotion                       | Yes (implemented) | `notify` catches and logs; unit test "swallows…", integration test "a failing transport…" |

**Coverage: 11/11 implemented and tested on `main`.** Open items are hardening (N2) and two confirmations (promoted-employee banner, date format), not AC gaps.
