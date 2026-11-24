# LATC-114 — Send notification after registration or waitlist promotion — Alex Ngo

- **Story card:** LATC-114 (moved to In Progress)
- **Copied from:** LATC-8 (status: Backlog, untouched)
- **Kicked off:** 2026-11-24 by Alex Ngo via /kickoff
- **Base:** `main` at `0d2e73b` (rebased from `latc-90` on request). Note: `main` already implements LATC-8 (`api/src/notifications/`, `app/src/components/Banner.tsx`, `e2e/tests/latc-8-notifications.spec.ts`), so this story starts as a review / gap check against the ACs below.
- **Branch:** `latc-114-notify-on-confirm`

## Acceptance criteria

**User interactions (in-app feedback)**

- [ ] After registering (confirmed), the page shows a success banner: "You're registered! [Session title] on [formatted date]"
- [ ] After joining the waitlist, the page shows: "You're on the waitlist for [Session title]. We'll let you know if a spot opens up."
- [ ] Both banners appear immediately after submit, without a page reload
- [ ] The banners can be dismissed by the user or auto-dismiss after a few seconds
- [ ] If the backend notification fails, the banner still appears (failure is silent)

**Backend notification**

- [ ] After a successful registration (`confirmed`), a notification event is emitted on the server
- [ ] After a waitlist promotion (`confirmed` via WH-5), a notification event is emitted on the server
- [ ] The notification includes: employee name, email, session title, session date, status (`confirmed` or `promoted`)
- [ ] Baseline: the notification is logged to the server console
- [ ] Optional: if `SLACK_WEBHOOK_URL` is set, a Slack message is sent to the configured channel
- [ ] Notification failures must not fail the registration or promotion (fire-and-forget)

## Out of scope

Real email delivery, SMS notifications, notification for cancellation, notification history or inbox.

Requirements analysis: run `/spdd-analysis LATC-114` → `spdd/analysis/LATC-114-*`
