Minimal copy of the repo used as the `working_dir` for `labs/agentic.yaml`.
promptfoo copies it to a temp dir per test, so the agent's writes never touch the real repo.
`api/src/` holds only a decoy; the test-writer agent must not read it.
