// Shared runner for verify/latc-*.mjs scripts.
// Runs the Jest tests tagged with the story id, then the story's Playwright spec in a
// visible (headed) Chromium window, slowed down so you can watch each step.
//
// Options (env):
//   SLOW_MO=800      ms between browser actions (default 800)
//   SHOW_CURSOR=0    hide the red cursor highlight and scenario caption (shown by default)
//   CLICK_PAUSE=10000 ms to wait after each click / page load (default 10000)
//   FILL_PAUSE=3000  ms to wait after typing into a field (default 3000)
//   STEP=1           step-by-step: Playwright Inspector waits for you before every action
//   DEMO_PAUSE=4000  ms to hold the final screen of each scenario (default 4000)
//   SKIP_JEST=1      only run the browser tests
//   SKIP_E2E=1       only run the Jest tests
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STORIES } from './stories.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function run(title, cmd, args, cwd, env = {}) {
  console.log(`\n\x1b[1m▶ ${title}\x1b[0m\n  $ ${cmd} ${args.join(' ')}\n`)
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } })
  return r.status === 0
}

export function verifyStory(storyNumber) {
  const tag = `LATC-${storyNumber}`
  const specDir = path.join(root, 'e2e', 'tests')
  const spec = readdirSync(specDir).find((f) => f.startsWith(`latc-${storyNumber}-`))
  const results = []

  const story = STORIES[storyNumber]
  if (story) {
    console.log(`\n\x1b[1;36m${story.title}\x1b[0m`)
    for (const line of story.summary) console.log(`  • ${line}`)
  }

  if (!process.env.SKIP_JEST) {
    results.push([
      `Jest (API) tests for ${tag}`,
      run(`Jest (API) tests for ${tag}`, 'pnpm', ['exec', 'jest', '--runInBand', '-t', tag], path.join(root, 'api')),
    ])
  }

  if (!process.env.SKIP_E2E) {
    if (!spec || !existsSync(path.join(specDir, spec))) {
      console.error(`No Playwright spec found for ${tag} in e2e/tests`)
      process.exit(1)
    }
    results.push([
      `Playwright (headed) ${spec}`,
      run(
        `Playwright (headed browser) ${spec}`,
        'pnpm',
        [
          'exec',
          'playwright',
          'test',
          `tests/${spec}`,
          '--headed',
          '--reporter=list',
          ...(process.env.GREP ? ['-g', process.env.GREP] : []),
          ...(process.env.STEP
            ? ['--debug', '--timeout=0']
            : ['--timeout=600000']), // generous, but a stuck demo still ends
        ],
        path.join(root, 'e2e'),
        {
          SLOW_MO: process.env.STEP ? '0' : (process.env.SLOW_MO ?? '300'),
          CLICK_PAUSE: process.env.STEP ? '0' : (process.env.CLICK_PAUSE ?? '10000'),
          FILL_PAUSE: process.env.STEP ? '0' : (process.env.FILL_PAUSE ?? '3000'),
          SHOW_CURSOR: process.env.SHOW_CURSOR === '0' ? '' : '1',
          DEMO_PAUSE: process.env.STEP ? '0' : (process.env.DEMO_PAUSE ?? '4000'),
          DEMO_STORY: story ? JSON.stringify(story) : '',
        }
      ),
    ])
  }

  console.log(`\n\x1b[1m${tag} summary\x1b[0m`)
  for (const [name, ok] of results) console.log(`  ${ok ? '\x1b[32m✔' : '\x1b[31m✘'} ${name}\x1b[0m`)
  process.exit(results.every(([, ok]) => ok) ? 0 : 1)
}
