---
name: opencode-commit
description: "Create a safe, well-formed git commit on a feature branch in the WorkshopHub repo. Use this whenever the user wants to commit, 'commit this', 'save my work', 'make a commit', or record their changes in git — even if they don't say the word 'commit'. It refuses on the main branch, shows git status and a short diff summary, drafts a commit message prefixed with the Jira card read from the branch name (e.g. [LATC-2], asking the user for one if the branch has none), stages only the relevant files, runs git commit after the user confirms, and stops without pushing. It never commits secrets and never bypasses git hooks with --no-verify. Do NOT use this skill to push, open a pull request, merge, rebase, or resolve merge conflicts."
---

# Commit

Help the user record their work as **one clean, reviewable commit on a feature
branch**, then stop. The goal is a commit that is safe to push later: a coherent
unit of change, on a feature branch, with a clear message, and nothing sensitive
inside it.

Why the workflow has the shape it does:

- **Branch guard** — the team works on `LATC-*` feature branches and reviews
  before anything reaches `main`. A commit on `main` skips that review, so we
  refuse it.
- **Card prefix** — every commit in this repo is tagged with its Jira card
  (`[LATC-2]`, `[LATC-6]`, …). The card lives in the branch name, so read it
  from there rather than guessing.
- **Confirm before writing** — the user should see the exact message and the
  exact files that are about to be recorded.
- **Stop, don't push** — pushing is a separate, deliberate action. It triggers
  the pre-push test/lint/format/security gate, and a local commit can still be
  amended; a pushed one can't. Leave the push to the user.

## Workflow

### 1. Refuse on `main`

Run `git branch --show-current`. If the current branch is `main` (or another
protected branch), **stop and do not commit**. Tell the user that commits must
land on a feature branch, and offer to create one, e.g.:

```
git checkout -b LATC-3-waitlist-when-full
```

then ask them to re-run this skill. Never commit to `main`.

### 2. Show what's changed

Run `git status` plus a short diff summary:

```
git status
git diff --stat          # unstaged changes
git diff --cached --stat # already-staged changes
```

Give the user a one-paragraph summary: which files changed, roughly what the
change does, and call out any untracked files. If the working tree is clean
(nothing to commit), say so and stop.

### 3. Find the Jira card

Read the branch name and extract the card token — a `[A-Z]+-\d+` like `LATC-2`
(the card number the user should prefix the commit with):

```
git branch --show-current
```

- **Found one:** use it (e.g. `LATC-2`).
- **Several match:** use the first and confirm it, or ask which one.
- **None found:** ask the user — *"No Jira card in branch `X`. What card
  (e.g. `LATC-3`) should I prefix the commit with?"* — and wait for the answer.
  Do **not** invent a card number.

### 4. Draft the commit message

Match the repo's convention. Check `git log --oneline -10` to confirm the exact
style; today it is `[CARD] <imperative summary>`:

```
[LATC-2] Employee can register for an available training session
[LATC-6] Assert full session info on the detail page
```

- Subject in the **imperative mood**, under ~72 chars, summarizing *what* and
  *why* — not *how*.
- For a non-trivial change, add a body after a blank line: a couple of lines on
  the motivation or behaviour change. Subject and body should each read on
  their own.
- If the team prefers full Conventional Commits, weave a type in
  (`[LATC-2] feat(registrations): ...`), but otherwise follow whatever `git log`
  shows as the norm for this repo.

### 5. Confirm with the user

Show the proposed message (subject + body) **and** the list of files you intend
to stage, then ask the user to confirm, edit, or cancel. **Do not run
`git commit` until the user confirms.** This step exists so the user signs off
on exactly what gets recorded — don't skip it.

### 6. Stage the relevant files

Stage only the files that belong to this change. Do **not** `git add -A` or
`git add .` blindly — that sweeps in unrelated and sensitive files. Add the
specific paths from the diff instead.

Never stage or commit any of these. They are in `.gitignore`, but `git add -f`
or a stray `git add .` can get past that guard:

- **Secrets & environment:** `.env`, `.env.*`, anything holding a credential,
  key, or token.
- **Generated / build artifacts:** `dist/`, `build/`, `api/generated/`,
  `coverage/`.
- **Databases:** `database/*.sqlite*`, `api/database/*.sqlite*` (the local DB
  files).
- **Local-only tooling:** `openspec/`, `verify/` (gitignored by this repo).

If a file's role is ambiguous, leave it unstage and ask rather than guessing.

### 7. Commit

Run the commit with the confirmed message:

```
git commit -m "[LATC-2] <summary>" -m "<body, if any>"
```

- **Never** pass `--no-verify` / `-n` — let the git hooks run.
- **Never** bypass the security scan or the pre-push gate.

### 8. Stop — do not push

Once the commit succeeds, **stop**. Report the new commit
(`git log -1 --oneline`) and remind the user it is **local only and not
pushed**. Pushing is a separate, explicit action for the user to take (or
request) on their own.

## Definition of Done (from `AGENT.md`)

For the team, a commit isn't really "done" unless the change passes the gates the
pre-push hook enforces. If this change touches code, recommend the user run them
before they eventually push — offer to run them, but don't block the commit on
them:

- `make test` — unit + integration tests green
- `make lint` — ESLint clean across `app` and `api`
- `make format-check` — Prettier clean
- No new `any`; no new direct Prisma imports in `api/src/routes/*`
- No secrets, `.env`, or generated artifacts in the commit

## Quick reference

| Step | Do | Never |
| ---- | -- | ----- |
| Branch | refuse on `main` | commit on `main` |
| Card | read `LATC-N` from the branch; ask if absent | invent a card |
| Message | `[LATC-N] <imperative summary>`; confirm first | skip confirmation |
| Staging | add only the relevant files | `git add -A`, stage secrets / artifacts / DBs |
| Commit | `git commit` | `--no-verify` |
| After | stop, report, don't push | `git push` |
