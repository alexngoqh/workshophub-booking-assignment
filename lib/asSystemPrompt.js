// promptfoo prompt function: load the artifact under test as the system prompt and send the
// test's `request` as the user turn. `vars.source` is relative to the repo root.
const fs = require('fs')
const path = require('path')

module.exports = async function asSystemPrompt({ vars }) {
  if (!vars.source) throw new Error('asSystemPrompt: vars.source is required')
  const artifact = fs.readFileSync(path.resolve(__dirname, '..', vars.source), 'utf8')
  return [
    { role: 'system', content: artifact },
    { role: 'user', content: vars.request },
  ]
}
