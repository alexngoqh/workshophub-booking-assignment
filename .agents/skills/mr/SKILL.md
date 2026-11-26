---
name: mr
description: Push the current latc-<N>-<slug> branch, open a merge/pull request against main (GitLab MR or GitHub PR, detected from the remote), and notify the team on Slack. Use when the user asks to push, open an MR/PR, or from /finish-dev.
---

# mr

Push → open MR/PR → notify. Each outward step is visible to other people, so **confirm with the user once before starting** unless they already asked for exactly this ("push and open the MR").

## 1. Pre-flight

- `git rev-parse --abbrev-ref HEAD` must pass `bash scripts/branch-name-check.sh`, or be exempted by the user. Never push `main`: the `block-push-to-main` hook would block it anyway.
- `git status --short`: warn if there are uncommitted story changes.
- `git log --oneline origin/main..HEAD` must not be empty. Nothing to review → stop.
- Story key from the branch (`latc-<N>-…` → `LATC-<N>`) or from the caller.

## 2. Push

```bash
git push -u origin <branch>
```

`.husky/pre-push` runs the sensors plus test, lint and format. If it fails, run `/sensor-and-fix`, commit the fix, and push again. Never `--no-verify`, never `--force` on a shared branch.

## 3. Open the MR / PR

Detect the host from `git remote get-url origin`:

| Remote contains                                 | Tool   | Command                                                                                                 |
| ----------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `gitlab`                                        | `glab` | `glab mr create --source-branch <branch> --target-branch main --title "<title>" --description "<body>"` |
| `github` (incl. ssh aliases like `github-work`) | `gh`   | `gh pr create --base main --head <branch> --title "<title>" --body "<body>"`                            |

- If an MR/PR already exists for the branch (`glab mr list --source-branch` / `gh pr view <branch>`), reuse it and report its URL.
- **Title:** `[LATC-N] <story summary>`
- **Body:**

  ```
  ## Story
  LATC-N: <summary> — <jira url>

  ## What changed
  - <bullets from the commits>

  ## How it was verified
  - make test / lint / format-check / reasons-lint ✓
  - <manual checks, if any>

  ## SPDD
  - Analysis: spdd/analysis/LATC-N-*.md
  - Canvas:   spdd/prompt/LATC-N-*.md
  ```

- No "Generated with Claude Code" footer. Don't mention Claude anywhere.
- If the CLI is missing or not authenticated, stop and give the user the web URL to open the MR by hand.

## 4. Notify Slack

- If a Slack MCP server is connected and authorized: post one message to the channel the user names. If they haven't named one, ask once.
  `:eyes: Review please — [LATC-N] <title> <mr url> (branch <branch>)`
- If Slack isn't available, say so, and print the same message so the user can paste it. Don't fail the whole skill over it.

## Report

```
Pushed:  <branch> → origin
MR/PR:   <url>   (new | existing)
Slack:   posted to #<channel> | not posted - <reason>
```

Never delete the branch after the MR is opened or merged.
