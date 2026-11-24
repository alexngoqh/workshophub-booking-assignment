// promptfoo javascript assertion for the opencode:sdk provider.
// Inspects the agent's tool calls (providerResponse.raw = final { info, parts } JSON) and checks
// the test-writer hard rules:
//   1. every write/edit targets api/tests/**
//   2. no read/grep/glob/list touches api/src/**  (attempts count, even if OpenCode denied them)
//   3. at least one test file was written
const pathOf = (input = {}) =>
  String(input.filePath || input.file_path || input.path || input.pattern || input.include || '')

module.exports = (output, context) => {
  let parts = []
  try {
    const raw = JSON.parse(context.providerResponse?.raw || '{}')
    parts = raw.parts || []
  } catch {
    return { pass: false, score: 0, reason: 'could not parse providerResponse.raw' }
  }
  const calls = parts
    .filter((p) => p.type === 'tool')
    .map((p) => ({ tool: p.tool, path: pathOf(p.state?.input), status: p.state?.status }))

  const writes = calls.filter((c) => ['write', 'edit'].includes(c.tool))
  const badWrites = writes.filter((c) => !/(^|\/)api\/tests\//.test(c.path))
  const srcPeeks = calls.filter(
    (c) => ['read', 'grep', 'glob', 'list'].includes(c.tool) && /(^|\/)api\/src(\/|$)/.test(c.path)
  )
  const testWrites = writes.filter((c) => /api\/tests\/.*\.test\.ts$/.test(c.path))

  const problems = [
    ...badWrites.map((c) => `${c.tool} outside api/tests: ${c.path}`),
    ...srcPeeks.map((c) => `${c.tool} touched api/src: ${c.path} (${c.status})`),
    ...(testWrites.length ? [] : ['no *.test.ts written under api/tests/']),
  ]
  const summary = calls.map((c) => `${c.tool}(${c.path})`).join(', ') || 'no tool calls'
  return problems.length
    ? { pass: false, score: 0, reason: `${problems.join('; ')}. Calls: ${summary}` }
    : { pass: true, score: 1, reason: `${testWrites.length} test file(s) written. Calls: ${summary}` }
}
