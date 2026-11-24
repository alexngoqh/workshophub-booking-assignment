---
name: tdd
description: Red-green loop for ONE WorkshopHub slice (one acceptance criterion or one Operation) per run. Delegates RED to the test-writer agent and GREEN to the implementer agent; this skill runs make test itself and pauses for the navigator to confirm RED. Use when the user says tdd, red-green, test-first, or wants to implement a single AC/Operation. Do not use it for a whole story at once.
---

# TDD: one slice, red → green → stop

Claude Code port of `.opencode/skills/opencode-tdd/SKILL.md`. Same loop; agents are
`.claude/agents/test-writer.md` and `.claude/agents/implementer.md`.

You orchestrate. **You do not write tests or implementation yourself.** You
delegate to the project agents **test-writer** and **implementer** (Agent tool,
`subagent_type: "test-writer"` / `"implementer"`) and run the gates.

**Hard rule: ONE slice per skill run → stop.**

## 1. Ask the navigator for ONE slice

Ask which **single** slice we are implementing. Accept whatever they provide:

- a pasted story acceptance criterion;
- an Operation from the REASONS canvas;
- a canvas excerpt.

If they give a whole story, or something vague like "implement LATC-8", ask them
to pick one AC or Operation. Do not choose for them, and do not plan a
whole-story suite.

## 2. Build the packet

Build a packet for the agents. It MAY include any of:

- AC / **Operation** text
- **Requirements**
- **Entities**
- **Approach**
- **Structure** (intended module paths)
- **Norms**
- **Safeguards**
- out-of-scope do-nots
- intended module paths

Pass through what the navigator provides. **Do not strip Approach or
Operations.** Do not invent a whole-story suite or widen the slice. Never paste
code from `api/src` into the packet.

## 3. RED: delegate to `test-writer`

Invoke the **test-writer** agent with the packet. It must not read `api/src/`. It
writes only under `api/tests/` and does not run tests.

**Path gate (Claude Code has no per-path agent permissions, so check it here):**

```bash
git status --short
```

Every changed or new file must be under `api/tests/`. If anything else changed,
revert those files (`git checkout -- <path>` / delete new ones) and send the
problem back to test-writer.

## 4. RED gate: run `make test` yourself, then PAUSE

Run:

```bash
make test
```

Show the navigator the **failure output** for the new tests: test names and the
expected-vs-received lines. Say whether each one fails **for the right reason**
(missing behaviour, wrong status or body) rather than a syntax, import, or setup
error.

Then **PAUSE** and ask the navigator to confirm RED, e.g. "These tests fail for
the right reason. Confirm RED to continue?"

- **Do not implement yet.**
- If they don't confirm, or a test fails for the wrong reason, send the issue back
  to test-writer and repeat steps 3–4.

Before continuing, record `git diff --stat api/tests` (plus `git status --short
api/tests` for new files) so the GREEN gate can compare.

## 5. GREEN: delegate to `implementer`

Only **after the navigator confirms RED**, invoke the **implementer** agent with:

- the **same packet**;
- the failing tests' names, files, and failure output from step 4.

## 6. GREEN gate: run `make test` yourself

Run `make test` again and confirm it is **green**. Then check the implementer did
not touch the tests:

```bash
git diff --stat api/tests   # must be identical to the snapshot from step 4
```

If any test file changed, revert that change and report it; the slice is not
GREEN. Report: slice → tests added → files changed → `make test` result.

## 7. STOP

Do not start the next slice. For another slice, the navigator runs the skill
again.
