---
name: commit
description: Commit staged story work on a latc-<N>-<slug> branch with the [LATC-N] message convention. Runs the branch-name sensor first and goes through the pre-commit hook. Use when the user asks to commit, or from /finish-dev.
---

# commit

Make one clean local commit for the current LATC story.

## 1. Branch check (sensor)

```bash
bash scripts/branch-name-check.sh
```

- Exit 0 → continue.
- Exit 1 → **stop**. Show the suggested `git branch -m …` and ask the user whether to rename the branch or commit once with `BRANCH_NAME_EXEMPT=<branch>`. Never rename on your own.
- On `main` → stop. Commits never go to main.

## 2. Story key

`latc-<N>-…` → `LATC-<N>`. If the caller passed a key, use it. Otherwise ask; don't guess.

## 3. Stage

- `git status --short` and `git diff --stat` (staged and unstaged).
- Stage only files that belong to this story, **by name**. Never `git add -A` / `git add .`.
- Never stage `.env*`, `*.sqlite`, `node_modules/`, `dist/`, `settings.local.json` or editor files.
- If you're unsure about a file, list it and ask.
- Nothing to stage → say so and stop.

## 4. Message

```
[LATC-N] <imperative summary, ≤72 chars total>

- <what changed and why>
- <2–5 bullets>
```

- Write it from the diff and `spdd/prompt/LATC-N-*.md`.
- No `Co-Authored-By: Claude` trailer. Don't mention Claude or Claude Code.

## 5. Commit

```bash
git commit -F - <<'EOF'
...
EOF
```

- Commit through the hooks. Never use `--no-verify`.
- If `.husky/pre-commit` fails, fix the cause (see `/sensor-and-fix`), re-stage and make a **new** commit. Never `--amend` after a hook failure.
- Don't push. That's the `mr` skill's job.

## Report

`<short-sha> [LATC-N] <subject>`, followed by the list of committed files.
