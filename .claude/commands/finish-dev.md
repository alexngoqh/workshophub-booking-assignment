---
description: Finish a story - verify sensors, commit, push, open the MR, notify Slack,
  and move the Jira card to In Review
---

Close out development on the current story: make sure the sensors are green, commit the work, push it, open the MR/PR, notify the team, and move the LATC Jira card to **In Review**.

**Input**: optional argument after `/finish-dev`:

- empty → work out the story key from the branch name (`latc-<N>-...` → `LATC-<N>`)
- a key such as `LATC-3` → use that key instead
- `LATC-3 on replica card` → commit against `LATC-3`, but move the user's personal copy of that card (see step 5)
- `-m "<summary>"` → use this as the commit subject

## Steps

### 1. Identify the story

- Run `git rev-parse --abbrev-ref HEAD`. If the branch matches `latc-<N>-...`, the key is `LATC-<N>`.
- If you can't derive a key and none was given, ask the user. Don't guess.
- If the branch is `main`, stop. Commits don't go to main.

### 2. Gate on the sensors

- Run `/sensor-and-fix`. Continue only when every sensor is ✓.
- If a sensor is still red, stop and report it. Don't commit, and don't move the card.

### 3. Commit

Follow the **`commit`** skill (`.claude/skills/commit/SKILL.md`), passing the story key and any `-m` summary. The skill covers the branch check, staging by name, the `[LATC-N]` message without Claude attribution, and committing through the pre-commit hook without `--amend`.

If there's nothing to commit, say so and continue: the branch may already hold the commits.

### 4. Push, open the MR and notify

Follow the **`mr`** skill (`.claude/skills/mr/SKILL.md`): push (the `.husky/pre-push` gate runs), open or reuse the GitLab MR or GitHub PR against `main`, and post the review request to Slack.

- Running `/finish-dev` counts as the user asking for the push and the MR. Still confirm the Slack channel if it hasn't been given.
- If the push or MR fails, stop. Don't move the card to In Review without a reviewable MR.
- Keep the MR/PR URL for step 5.

### 5. Move the Jira card to In Review

Use the **`jira`** MCP server (Atlassian v2, `https://mcp.atlassian.com/v2/mcp`, configured in `.mcp.json`). Don't use `plugin:engineering:atlassian`: it's on the deprecated v1 endpoint. Only fall back to it if `jira` isn't available, and tell the user when you do.

0. **cloudId**: call `mcp__jira__getAccessibleAtlassianResources` once and reuse the result. The site is `thoughtworks.atlassian.net`.
1. **Replica card**: if the argument says `replica` (e.g. `LATC-3 on replica card`), the card to move is the user's personal copy, not the original story:
   - Get the user's display name from `mcp__jira__atlassianUserInfo`.
   - Get the original story's summary from `mcp__jira__getJiraIssue LATC-N`.
   - Search with `mcp__jira__searchJiraIssuesUsingJql`: `project = LATC AND summary ~ "<display name>" AND summary ~ "<original summary>"`.
   - Exactly one match → use that key from here on. Zero or several matches → list them and ask the user which one. Never touch the original `LATC-N`.

2. `mcp__jira__getJiraIssue` for the card. Confirm it exists and note its current status.
3. If it is already **In Review** or later (Done), report that and stop.
4. List the transitions. This one isn't a primary tool on v2, so call it like this:
   `mcp__jira__executeRead({ name: "listJiraIssueTransitions", cloudId, inputs: { issueIdOrKey: "<KEY>" } })`.
   Pick the transition whose **target status** (`to.name`) is `In Review`, matched case-insensitively. Don't match on the transition's own name. (On this site the id is usually `251`, but always look it up.)
5. `mcp__jira__transitionJiraIssue` with that transition id. Its response returns the new status, so you don't need to read the card back.
6. Use `mcp__jira__addOrEditJiraIssueComment` to add the MR/PR URL, the commit SHA and the branch name to the card.

If an operation isn't in your tool list, look it up with `mcp__jira__discover`. Don't guess its name.

If there's no `In Review` transition from the current status, list the transitions that are available and ask the user which one to use. Don't chain several transitions on your own.

If the `jira` MCP server isn't connected or authorized, say so plainly. Tell the user to run `/mcp`, choose `jira`, then Authenticate. Report the commit as done and the card as **not moved**, and give them the URL so they can move it by hand.

## Output

```
Story:   LATC-N  (<title>)
Branch:  latc-N-...
Commit:  <short-sha> [LATC-N] <subject>
Sensors: all ✓
Jira:    <old status> → In Review   (or: not moved - <reason>)
MR/PR:   <url>
Slack:   posted to #<channel> | not posted - <reason>
Next:    wait for review; never delete the branch after merge
```