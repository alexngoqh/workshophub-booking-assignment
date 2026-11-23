---
name: /finish-dev
id: finish-dev
category: Development
description: Finish a story - verify sensors, commit with the [LATC-N] prefix, and move the Jira card to In Review
---

Close out development on the current story: make sure the sensors are green, commit the work, and move the LATC Jira card to **In Review**.

**Input**: optional argument after `/finish-dev`:

- empty → work out the story key from the branch name (`latc-<N>-...` → `LATC-<N>`)
- a key such as `LATC-3` → use that key instead
- `-m "<summary>"` → use this as the commit subject

## Steps

### 1. Identify the story

- Run `git rev-parse --abbrev-ref HEAD`. If the branch matches `latc-<N>-...`, the key is `LATC-<N>`.
- If you can't derive a key and none was given, ask the user. Don't guess.
- If the branch is `main`, stop. Commits don't go to main.

### 2. Gate on the sensors

- Run `/sensor-and-fix`. Continue only when every sensor is ✓.
- If a sensor is still red, stop and report it. Don't commit, and don't move the card.

### 3. Review what will be committed

- Run `git status --short` and `git diff --stat`, including staged changes.
- Stage only the files that belong to this story, and add them by name. Never use `git add -A` or `git add .`.
- Leave out anything that looks like secrets or local noise: `.env*`, `*.sqlite`, `node_modules`, editor files, `settings.local.json`. If you're unsure about a file, list it and ask the user.
- If nothing is staged, tell the user and skip to step 5, provided they still want the card moved.

### 4. Commit

- Subject format: `[LATC-N] <imperative summary>`, at most 72 characters. Take the summary from `-m` if it was given. Otherwise write it from the diff and the story's SPDD prompt in `spdd/prompt/LATC-N-*.md`.
- Body: 2–5 bullet points on what changed and why.
- Don't add a `Co-Authored-By: Claude` trailer, and don't mention Claude or Claude Code anywhere in the message.
- Commit through the normal hooks. Never use `--no-verify`. If the pre-commit hook fails, fix the cause (see `/sensor-and-fix`) and create a **new** commit. Don't use `--amend`.
- Don't push unless the user asks.

### 5. Move the Jira card to In Review

Use the Atlassian MCP tools:

1. `getJiraIssue` for `LATC-N`. Confirm the issue exists and note its current status.
2. If it is already **In Review** or later (Done), report that and stop.
3. `getTransitionsForJiraIssue`. Find the transition whose target status is `In Review`, matching the name case-insensitively.
4. `transitionJiraIssue` with that transition id.
5. Optionally, use `addCommentToJiraIssue` to add the commit SHA, the branch name and a one-line summary.

If there's no `In Review` transition from the current status, list the transitions that are available and ask the user which one to use. Don't chain several transitions on your own.

If the Jira/Atlassian MCP server isn't connected or authorized, say so plainly. Tell the user to authorize it via `/mcp` or the claude.ai connector settings. Report the commit as done and the card as **not moved**, and give them the URL so they can move it by hand.

## Output

```
Story:   LATC-N  (<title>)
Branch:  latc-N-...
Commit:  <short-sha> [LATC-N] <subject>
Sensors: all ✓
Jira:    <old status> → In Review   (or: not moved - <reason>)
Next:    git push -u origin <branch> && open a PR
```
