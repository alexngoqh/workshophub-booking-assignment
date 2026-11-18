---
description: "Kick off a Jira card for development: read it with getJiraIssue, then either copy it to a new card titled 'Alex Ngo: <original title>' and move the copy into In Development, or — if it is already in In Development — leave an attempt comment on the original via addCommentToJiraIssue. Save the story to ./stories, then create and checkout a latc-{id}-{desc} branch after confirming its name, and stop. Never mutates the original card and never pushes."
---

// allowed-tools
Question, Bash, getJiraIssue, editJiraIssue, createJiraIssue, transitionJiraIssue, addCommentToJiraIssue
# Original spec whitelist was: Question, Bash, getJiraIssue, editJiraIssue.
# createJiraIssue and transitionJiraIssue were ADDED (per the kickoff decision) because
# copying a card and moving it into In Development need write/transition tools the
# original four did not include.

You are running the **kickoff** workflow for the Jira card `$ARGUMENTS` (run as
`/kickoff LATC-2`; if no key was passed, ask for it in step 1). The goal: start
development on a card **without ever mutating the original** — by working on a
*copy* — and then put the user on a feature branch to do the work.

## Tool whitelist
Use **only** these tools: `Question`, `Bash`, `getJiraIssue`, `editJiraIssue`,
`createJiraIssue`, `transitionJiraIssue`, `addCommentToJiraIssue`.
`editJiraIssue` changes issue fields — never call it on the original card.

OpenCode has no native per-command `allowed-tools` field (command frontmatter only
supports `description`, `agent`, `model`, `subagent`), so this whitelist is enforced
by *this prompt*, not by config. The jira tools are the Atlassian MCP tools
(`tools.jira.getJiraIssue`, `...editJiraIssue`, `...createJiraIssue`,
`...transitionJiraIssue`); call them through the jira MCP / Code Mode as available.
File I/O and all git operations go through `Bash` — there is no whitelisted Write or
Edit tool, so do not reach for one.

## Hard invariants (never violate)
- **NEVER edit, change, or move the original card.** The original is only ever
  *read* (`getJiraIssue`). In the already-in-Development path you may add one
  *additive* comment via `addCommentToJiraIssue` — a comment is a record, not a change to the
  card's fields or status, so it respects this rule. The **copy** is the only card
  that ever gets transitioned.
- **NEVER use `--no-verify`, force-push (`-f`), or push at all.** This command ends at
  a local branch.
- Stay inside the whitelist. If a step needs a tool that isn't whitelisted, **stop and
  say which tool is missing** rather than reaching outside the list.

## Steps

1. **Get the card key.** Card key argument: `$ARGUMENTS`.
   If it is empty, use the `Question` tool to ask: "Which Jira card? (e.g. LATC-2)".
   Validate it matches `LATC-<number>` (case-insensitive, normalise to upper case);
   if it does not, ask again with `Question`. Do not guess a key.

2. **Read the card.** Call `getJiraIssue` for the key. Capture: current status (which
   column), summary/title, description, issue type, project key, and any labels,
   components, or custom fields worth copying.

3. **Branch on current status** — is the card in the **In Development** column?

   - **NOT in In Development → create a copy and move the copy:**
     a. Use `Question` to confirm the proposed new card: title `Alex Ngo: <original
        title>`, same project and issue type, with the description and labels copied.
        A quick confirm avoids duplicate cards on re-runs.
     b. `createJiraIssue` to make the copy with that title and the copied fields.
        Record the new card's key (e.g. `LATC-9`).
     c. `transitionJiraIssue` to move the **copy** into **In Development**.
     d. Leave the original card exactly as it was.

   - **ALREADY in In Development → comment instead:**
     a. `addCommentToJiraIssue` to add a comment on the **original** card, e.g.:
        "Kicked off by /kickoff (<date>) by Alex Ngo. Card is already in In Development,
        so no copy was created; proceeding to a feature branch." This is additive — do
        not change any field or status.

4. **Save the story to `./stories`.** With `Bash` (heredoc — no Write tool is
   whitelisted), ensure `./stories` exists (`mkdir -p ./stories`) and write
   `./stories/<KEY>.md` (e.g. `./stories/LATC-2.md`) containing: the original title,
   the copy's key (if one was created), the current status, the description, and the
   branch that will be created.

5. **Propose and confirm the branch.** Build `latc-{id}-{desc}`:
   - `{id}` = the numeric part of the card key (`LATC-2` → `2`).
   - `{desc}` = a short, lowercase, hyphenated slug of the card title (e.g. "Employee
     can register for an available training session" → `register-for-session`), trimmed
     to a reasonable length.
   Use `Question` to show the proposed branch name (e.g. `latc-2-register-for-session`)
   and get the user's confirmation or a rename. **Do not create it until confirmed.**

6. **Create and checkout the branch** from the current HEAD (currently `main`):
   `git checkout -b <confirmed-branch>`. If the branch already exists, tell the user and
   use `Question` to decide (switch to it vs. abort) — do **not** force or delete.

7. **Confirm and stop.** Report the branch name (and the new card key or comment, if
   any) and **stop**. Do **not** push, commit, or run any further git mutation. Pushing
   is a separate, explicit action the user takes.

## Done when
- [ ] Original card untouched — read-only, at most one additive comment.
- [ ] Either a copy exists in In Development, or an attempt comment is on the card.
- [ ] `./stories/<KEY>.md` written.
- [ ] On branch `latc-{id}-{desc}`, confirmed with the user; nothing pushed.
