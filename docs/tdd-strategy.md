# TDD strategy: Strategy A (one Operation per cycle)

We use **Strategy A** from the Day 4-02 homework, "Make SPDD and Multi-Agent TDD Work Together".

|                      |                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Unit of work         | One canvas Operation per red → green cycle                                                                                   |
| Where the loop lives | `.claude/workflows/deliver-story.js` (`tddOperation`), which runs `for` over the canvas `## Operations` in order             |
| Default              | `tdd` defaults to true. `tdd: false` falls back to batch `/spdd-generate`, which is non-TDD and must not be described as TDD |

## Why A rather than B

- It is the strictest form of atomic TDD. Each Operation has visible proof of RED before any implementation exists.
- The workflow runs unattended, so the per-cycle gate is mechanical rather than a human decision. That makes small slices cheap, and a failure points at exactly one Operation.

## One cycle

1. **RED: `test-writer` agent.** Its packet is the Operation plus the Requirements, Entities, Norms and Safeguards sections. It does not get Approach or Structure, and it never reads `api/src`.
2. **RED gate: an independent verifier.** This verifier replaces the navigator's "confirm RED". It checks that only files under `api/tests/` changed, and that `make test` has new failures that fail for the right reason, not because of syntax, import or setup errors. If the verifier rejects the tests, it sends feedback to test-writer, up to `maxRevisions` times.
3. **Commit the RED tests** as `[LATC-N] RED: tests for <Op>`. This is the proof of RED in git history.
4. **GREEN: `implementer` agent.** It gets the full canvas and the failing test output. It must never edit tests.
5. **GREEN gate: an independent verifier.** It checks that the committed tests are untouched (`git diff HEAD -- api/tests` is empty) and that `make test` and `make lint` are green. Then the code is committed as `[LATC-N] GREEN: ...`.
6. **Post-green adversarial challenge** (Day 4-02 #10). A test-writer writes one test that tries to break the new code (it has no Bash). A separate agent then runs `make test` and records the actual result as one of three outcomes:
   - real gap: the implementer fixes the code;
   - out of scope: the test is deleted and the reason recorded;
   - nothing found: the test is kept.

Operations that only touch schema, seed or config, and have no observable behaviour of their own, are not cycled on their own. They are passed to the implementer as supporting context, and after the loop a dedicated step applies any that are still missing, then runs `make sensors` and `make test` and commits.

## Shared rules (both strategies)

- Canvas first. The Operations list is the source of slices, and no extra Criteria section is invented.
- `tdd` never calls `/spdd-generate`.
