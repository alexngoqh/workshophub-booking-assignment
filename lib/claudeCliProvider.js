// promptfoo custom provider: runs the prompt through the local Claude Code CLI (`claude -p`),
// so evals use the developer's Claude login. No GOOGLE_API_KEY / ANTHROPIC_API_KEY needed.
//
// - The system message (the artifact under test) goes to --system-prompt, and the user turn goes to stdin.
// - Tools are disabled and project settings, CLAUDE.md and MCP are not loaded, so the model
//   answers from the artifact alone (same isolation as the old Gemini text-only provider).
// - Also usable as the llm-rubric grader (defaultTest.options.provider).
//
// Config: { model: 'haiku' | 'sonnet' | ... }  (env EVAL_CLAUDE_MODEL overrides; default haiku)
const { spawnSync } = require('child_process')
const os = require('os')

function split(prompt) {
  try {
    const msgs = JSON.parse(prompt)
    if (Array.isArray(msgs)) {
      const system = msgs
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n\n')
      const user = msgs
        .filter((m) => m.role !== 'system')
        .map((m) => m.content)
        .join('\n\n')
      return { system, user }
    }
  } catch {
    // plain-text prompt (e.g. the llm-rubric grader prompt)
  }
  return { system: '', user: prompt }
}

class ClaudeCliProvider {
  constructor(options = {}) {
    this.config = options.config || {}
    this.label = options.label
    this.providerId = options.id || 'claude-cli'
  }

  id() {
    return this.providerId
  }

  async callApi(prompt) {
    const { system, user } = split(prompt)
    const model = process.env.EVAL_CLAUDE_MODEL || this.config.model || 'haiku'
    const args = [
      '-p',
      '--model',
      model,
      '--output-format',
      'text',
      '--tools',
      '',
      '--setting-sources',
      '',
      '--strict-mcp-config',
      '--no-session-persistence',
    ]
    if (system) args.push('--system-prompt', system)
    const run = () =>
      spawnSync('claude', args, {
        input: user,
        encoding: 'utf8',
        cwd: os.tmpdir(), // no project CLAUDE.md
        timeout: 300000,
        maxBuffer: 10 * 1024 * 1024,
      })
    let r = run()
    if (r.error || r.status !== 0) r = run() // one retry for transient CLI/network failures
    if (r.error) return { error: 'claude CLI failed: ' + r.error.message }
    if (r.status !== 0) {
      return { error: 'claude CLI exit ' + r.status + ': ' + (r.stderr || r.stdout).slice(0, 500) }
    }
    return { output: r.stdout.trim() }
  }
}

module.exports = ClaudeCliProvider
