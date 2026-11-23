---
name: /kickoff
id: kickoff
category: Development
description: Start a LATC story - read the Jira card, move it (or the user's replica card) to In Progress, create the latc-<N>-<slug> branch, and write kickoff notes
---

Start work on a LATC story: understand it, claim the Jira card, and create a correctly named branch.

**Input**: the argument after `/kickoff`:

- `LATC-N`: kick off that story and move its card
- `LATC-N on replica card`: read `LATC-N`, but move the user's personal copy instead (see step 2)
- `--base <branch>`: branch from `<branch>` instead of `main`, for stories that depend on an unmerged story (e.g. LATC-3 depends on LATC-2)

If there's no key, ask. Don't guess.

## 1. Read the story

Use the `jira` MCP server (v2). Get the `cloudId` once with `mcp__jira__getAccessibleAtlassianResources`.

- `mcp__jira__getJiraIssue LATC-N`: summary, description, acceptance criteria, current status.
- Note any dependencies in the description (e.g. "After LATC-2 is implemented…"). If a dependency isn't merged into `main` and there's no `--base`, ask which branch to stack on.

## 2. Pick the card to move

- **Default:** `LATC-N` itself.
- **Replica:**
  - Get the user's display name from `mcp__jira__atlassianUserInfo`.
  - Search with `mcp__jira__searchJiraIssuesUsingJql`: `project = LATC AND summary ~ "<display name>" AND summary ~ "<LATC-N summary>"`.
  - One match → that's the card. Zero matches → ask the user whether to clone `LATC-N` for them. Several matches → ask which one.
  - Never move the original `LATC-N` in replica mode.

## 3. Move the card to In Progress

- If the card is already In Progress or later, leave it alone and say so.
- Otherwise list the transitions with `mcp__jira__executeRead({ name: "listJiraIssueTransitions", cloudId, inputs: { issueIdOrKey } })`. Pick the one whose **target status** is `In Progress`, then call `mcp__jira__transitionJiraIssue`.
- No such transition → list what's available and ask. Don't chain transitions.
- `jira` not authorized → tell the user to run `/mcp`, choose `jira`, Authenticate. Continue with steps 4–5 and report the card as not moved.

## 4. Create the branch

- `git status --short`: if there are uncommitted changes, ask before switching branches.
- Slug: 2–4 kebab-case words from the summary, e.g. `waitlist-when-full`.
- Branch: `latc-<N>-<slug>`. Check it with `bash scripts/branch-name-check.sh latc-<N>-<slug>` before creating it.
- `git fetch origin` and `git switch -c latc-<N>-<slug> origin/main`, or `<base>` when `--base` was given.
- If the branch already exists, switch to it and say so. Don't recreate it.
- Don't push. The `mr` skill pushes later.

## 5. Kickoff notes

Write `stories/LATC-N.md`:

```markdown
# LATC-N — <summary>

- **Original card:** LATC-N (status: <status>[, untouched])
- **Working copy:** <replica key and summary> (moved to In Progress) ← only for a replica card
- **Kicked off:** <YYYY-MM-DD> by <display name> via /kickoff
- **Base:** `<main or base branch>`
- **Branch:** `latc-<N>-<slug>`

## Acceptance criteria

<copied from the card as a checklist>

## Out of scope

<copied from the card>

Requirements analysis: run `/spdd-analysis LATC-N` → `spdd/analysis/LATC-N-*`
```

Don't commit the notes. The first `commit` on the branch includes them.

## Output

```
Story:   LATC-N  (<summary>)
Card:    <key> <old status> → In Progress   (or: not moved - <reason>)
Branch:  latc-<N>-<slug>  (from <base>)
Notes:   stories/LATC-N.md
Next:    /spdd-analysis LATC-N
```
