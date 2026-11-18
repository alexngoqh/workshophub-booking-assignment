---
name: tdd
description: "Drive a WorkshopHub change test-first by delegating to two subagents: test-writer (RED, blind to api/src) then implementer (GREEN). Use when the user wants to implement an acceptance criterion, story, or bug fix with TDD, 'red-green', 'write the tests first', or 'tdd this'. Do NOT use for pure refactors, docs, or config changes."
---

# TDD: test-writer → RED gate → implementer → stop

You are the **orchestrator**. You do not write tests or production code yourself.
You delegate each phase to a subagent and enforce the gate between them.

## 0. Scope the work

- Identify the card (from the branch name `latc-{id}-…` or ask) and the single
  acceptance criterion to implement. Read it from `stories/LATC-<id>.md`,
  `openspec/specs/**`, or Jira.
- If the request covers several criteria, take **one at a time**, run the full
  loop for it, then move to the next.
- Refuse to start on `main`. TDD work happens on a feature branch.

## 1. RED: delegate to `@test-writer`

Invoke the **test-writer** subagent with:

- the card key and the exact acceptance-criterion text;
- the expected HTTP contract (method, path, status codes, body shape) if it is
  known from the spec;
- a reminder that it needs **both unit and integration tests**.

Do **not** paste any code from `api/src` into its prompt. It must stay blind to
the implementation.

## 2. RED gate (you check it, don't trust it)

Run the files the test-writer reported:

```bash
cd api && pnpm exec jest <reported test files>
```

Continue only if all of the following hold:

- at least one **unit** test and one **integration** test were added;
- every new test **fails**, and fails for a behavioural reason (missing route,
  wrong status, missing export), not a syntax or import error in the test;
- no file under `api/src/` was modified (`git status --short api/src` is empty).

If any check fails, send it back to `@test-writer` with the specific problem.
After two failed attempts, stop and report to the user.

## 3. GREEN: delegate to `@implementer`

Invoke the **implementer** subagent with:

- the card key and acceptance criterion;
- the list of failing test files and their failure reasons from step 2.

## 4. Verify and stop

Check the implementer's claims yourself:

- the target tests pass;
- `make test`, `make lint`, and `make format-check` all pass;
- `git diff --stat api/tests` shows that the implementer did not change the
  tests (only the test-writer's additions are there).

Report to the user: criterion → tests added → files changed → gate results.
Then **stop**. Do not commit, refactor, or start the next criterion unless the
user asks. Use the `commit` skill when they want to commit.
