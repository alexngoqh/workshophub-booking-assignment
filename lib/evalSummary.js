#!/usr/bin/env node
// Summarise promptfoo --output JSON files as a Markdown table (pass rate per eval, and the
// failing test descriptions). Used by `make eval` and the CI job summary.
// Usage: node lib/evalSummary.js <result.json> [more.json ...]
const fs = require('fs')
const path = require('path')

function load(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const results = data.results || {}
  const rows = Array.isArray(results) ? results : results.results || []
  return { name: path.basename(file, '.json'), rows }
}

function summarise({ name, rows }) {
  const passed = rows.filter((r) => r.success).length
  const errors = rows.filter((r) => r.error && !r.gradingResult).length
  const failed = rows.length - passed - errors
  const failing = [
    ...new Set(
      rows
        .filter((r) => !r.success)
        .map((r) => (r.testCase && r.testCase.description) || r.description || '(no description)')
    ),
  ]
  return { name, total: rows.length, passed, failed, errors, failing }
}

const files = process.argv.slice(2).filter((f) => fs.existsSync(f))
if (files.length === 0) {
  console.log('No eval result files found.')
  process.exit(0)
}

const lines = ['| Eval | Passed | Failed | Errors | Pass rate |', '|---|---|---|---|---|']
const details = []
for (const s of files.map(load).map(summarise)) {
  const rate = s.total ? ((100 * s.passed) / s.total).toFixed(1) + '%' : 'n/a'
  const mark = s.failed + s.errors === 0 ? '✅' : '⚠️'
  lines.push(`| ${mark} ${s.name} | ${s.passed}/${s.total} | ${s.failed} | ${s.errors} | ${rate} |`)
  if (s.failing.length)
    details.push(`**${s.name}** not passing:`, ...s.failing.map((d) => `- ${d}`), '')
}
console.log([...lines, '', ...details].join('\n'))
