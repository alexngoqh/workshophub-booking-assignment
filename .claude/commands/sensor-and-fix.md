---
name: /sensor-and-fix
id: sensor-and-fix
category: Development
description: Run the harness sensors (reasons-lint, branch-name-check, format, lint, tests) as review steps, fix whatever fails, and re-run until green
---

Run the project's sensors as an ordered review pipeline. When a sensor fails, read its output, fix the root cause, and re-run that sensor until it passes, then move on. Finish with one full green pass.

**Input**: optional argument after `/sensor-and-fix`:

- empty → run every sensor below
- a sensor name (e.g. `reasons-lint`, `lint`) → run only that one
- a file path (e.g. `@spdd/prompt/LATC-2-...md`) → pass it to `reasons-lint` and skip the other sensors

Read [AGENT.md](../../AGENT.md) first. Its norms (no `any`, no Prisma in routes, definition of done) apply to every fix.

## Sensors (run in this order, cheapest first)

| #   | Sensor       | Command                                  | Checks                                 |
| --- | ------------ | ---------------------------------------- | -------------------------------------- |
| 1   | branch-name  | `bash scripts/branch-name-check.sh`      | branch is `latc-<story>-<slug>`        |
| 2   | reasons-lint | `bash scripts/reasons-lint.sh [file...]` | SPDD prompts follow the REASONS Canvas |
| 3   | format       | `make format-check`                      | Prettier                               |
| 4   | lint         | `make lint`                              | ESLint (app + api)                     |
| 5   | test         | `make test`                              | Jest unit + integration                |

## Loop for each sensor

1. Run the command and capture the exit code and output.
2. Exit 0 → record ✓ and go to the next sensor.
3. Non-zero → diagnose from the output, then apply a fix using the playbook below.
4. Re-run the **same** sensor. You get **3 attempts** per sensor. If it still fails after the third, stop the pipeline and report what you tried and what is still failing. Don't keep guessing.
5. A fix can break an earlier sensor, for example a code fix that breaks formatting. Once all sensors pass, run all five once more as the final check.

## Fix playbook

**branch-name**: never rename the branch yourself, because a rename affects the remote and open PRs. Show the suggested `git branch -m ...` command and ask the user whether to rename it or add it to `BRANCH_NAME_EXEMPT`. If they choose the exemption, re-run with `BRANCH_NAME_EXEMPT=<branch>` for the rest of the pipeline.

**reasons-lint**:

- _Missing section_: add the `## <Section>` heading in R-E-A-S-O-N-S order. Write its content from the matching story, the `spdd/analysis/` file and the code. Don't add placeholder text. If you can't derive the content, follow `/spdd-prompt-update` or ask the user.
- _Out of order_: move the whole section, with its sub-headings, to the right place. Don't change any wording.
- _Empty section_: fill it from the analysis file or the code, as for a missing section.
- _Duplicate section_: merge the duplicates into one and keep every unique point.
- _Operations without `### N.` steps_: turn the existing items into numbered `### N. <Action> - \`path\`` steps.
- Keep the file's existing wording wherever you can. Only change structure, and never touch the requirements.

**format**: run `pnpm run format` (or `pnpm exec prettier --write <files>`) only on the files that were flagged, then re-check.

**lint**: fix the code itself. Don't add `eslint-disable`, `any` or `@ts-ignore`. If a rule looks wrong for the case, stop and ask the user.

**test**:

- Find out whether the test or the code is wrong. The story and the REASONS prompt decide which is correct. Never weaken or delete a test just to make it pass.
- Integration tests share the dev DB. If failures look like leftover data, run `make reset-db` once and re-run before changing any code.

## Guardrails

- Don't use `--no-verify`, don't skip sensors, and don't edit the sensor scripts to make a check pass.
- Don't modify `docs/trainer-only/`.
- Fixes stay inside the scope of the failure. Don't refactor anything unrelated.
- Don't commit or push unless the user asks you to.

## Output

End with a summary table:

```
| Sensor       | Result | Attempts | Fix applied                          |
|--------------|--------|----------|--------------------------------------|
| branch-name  | ✓      | 1        | -                                    |
| reasons-lint | ✓      | 2        | moved ## Approach before ## Structure |
| ...          |        |          |                                      |
```

Follow the table with the files you changed, and any sensor that is still red along with what blocks it.
