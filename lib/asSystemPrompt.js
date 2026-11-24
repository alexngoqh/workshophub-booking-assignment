// promptfoo prompt function: the artifact under test becomes the system prompt and the
// request (plus optional context, e.g. the current branch) becomes the user turn.
const fs = require('fs')
const path = require('path')

module.exports = async function asSystemPrompt({ vars }) {
  if (!vars.source) throw new Error('asSystemPrompt: vars.source is required')
  const artifact = fs.readFileSync(path.resolve(__dirname, '..', vars.source), 'utf8')
  const user = vars.context ? `${vars.context}\n\n${vars.request}` : vars.request
  return [
    { role: 'system', content: artifact },
    { role: 'user', content: user },
  ]
}
