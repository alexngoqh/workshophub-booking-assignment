export const meta = {
  name: 'deliver-story',
  description:
    'Deliver one WorkshopHub story end-to-end (ultracode): kickoff, SPDD with adversarial gates, sensors with independent re-check, sync and finish-dev',
  whenToUse:
    'Run with args { storyId: "LATC-N" } (optional: replica: true, base: "<branch>", verify: false for the lean 7-agent path, maxRevisions: 0-3, default 2). Takes one Jira story from kickoff to an open PR with the card In Review. Every main step is checked by independent read-only reviewers; the run stops at the first step that needs a human decision.',
  phases: [
    {
      title: 'kickoff',
      detail: 'kickoff.md → independent check of card, branch and kickoff notes (no auto-repair)',
    },
    {
      title: 'spdd',
      detail:
        '/spdd-analysis → 2 skeptics → /spdd-reasons-canvas → 2 skeptics → /spdd-generate → 3-lens code review (each gate: revise up to maxRevisions)',
    },
    {
      title: 'sensor',
      detail:
        '/sensor-and-fix → independent re-run of every sensor, make test twice (loop until green)',
    },
    {
      title: 'finish',
      detail:
        '/spdd-sync → AC traceability critic (re-review if it changed code) → /finish-dev (push, PR, Jira In Review)',
    },
  ],
}

// ======================================================================================
// args
// ======================================================================================
// Accepts "LATC-8" or { storyId, replica?, base?, verify?, maxRevisions? }.
const input = typeof args === 'string' ? { storyId: args } : args || {}
const storyId = String(input.storyId || '')
  .trim()
  .toUpperCase()
if (!/^LATC-\d+$/.test(storyId)) {
  throw new Error(
    'deliver-story needs args.storyId like "LATC-8" (got ' + JSON.stringify(input.storyId) + ')'
  )
}
const replica = input.replica === true
const base = input.base ? String(input.base) : null
const VERIFY = input.verify !== false
const MAX_REVISIONS = Number.isInteger(input.maxRevisions)
  ? Math.max(0, Math.min(input.maxRevisions, 3))
  : 2
// Reviews and the PR are relative to the branch the story was cut from.
const TARGET = base || 'main'
const DIFF = 'git diff origin/' + TARGET + '...HEAD'

// ======================================================================================
// schemas
// ======================================================================================
const STEP = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['ok', 'blocked', 'failed'],
      description:
        'ok = step done; blocked = needs a human decision (question in reason); failed = could not complete',
    },
    reason: {
      type: 'string',
      description: 'Why blocked/failed, or the decision the navigator must make',
    },
    summary: { type: 'string', description: 'One or two sentences on what the step did' },
    branch: { type: 'string', description: 'Current git branch at the end of the step' },
    files: { type: 'array', items: { type: 'string' }, description: 'Files created or changed' },
    analysisPath: { type: 'string' },
    canvasPath: { type: 'string' },
    cardKey: {
      type: 'string',
      description: 'Jira key of the card moved/worked (replica key if any)',
    },
    commit: { type: 'string', description: 'Short SHA of the latest commit, if any' },
    codeChanged: {
      type: 'boolean',
      description: 'true if this step changed anything under api/src or app/src',
    },
    prUrl: { type: 'string' },
    jiraStatus: { type: 'string' },
  },
  required: ['status', 'summary'],
}

const VERDICT = {
  type: 'object',
  properties: {
    pass: {
      type: 'boolean',
      description: 'true only if you found NO blocking issue. When unsure, return false.',
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocking', 'minor'] },
          where: { type: 'string', description: 'file:line, section, or AC id' },
          detail: { type: 'string' },
          fix: { type: 'string', description: 'Concrete fix to apply' },
        },
        required: ['severity', 'detail'],
      },
    },
  },
  required: ['pass', 'issues'],
}

// ======================================================================================
// shared rules
// ======================================================================================
const RULES = [
  'You are one step of the deliver-story workflow, running unattended in the WorkshopHub repo.',
  'Command files live in .claude/commands/<name>.md: read the named file and follow it exactly (or invoke it as a skill if available).',
  'You CANNOT ask the user anything. Wherever the command would ask a question or pause for confirmation, STOP and return status "blocked" with the question in `reason`. Do not guess.',
  'Never use --no-verify, never edit a sensor or weaken a test to make it pass, never push to main, never merge a PR, never delete a branch.',
  'Never run make reset-db or any other destructive DB command. If failures look like leftover or out-of-sync DB data (the command would suggest a reset), return status "blocked" and say so.',
  'Report codeChanged=true if you changed anything under api/src or app/src.',
  'Return the StructuredOutput object as your final answer.',
].join('\n')

// Reviewers must not touch the shared dev DB: several run in parallel on one SQLite file.
const REVIEWER_RULES = [
  'You are an independent, skeptical reviewer in the deliver-story workflow. You did not write what you review.',
  'You are READ-ONLY: do not edit, create, delete, commit or push anything, and do not move Jira cards.',
  'Do NOT run make test or any command that touches the database. Reading files, git log/diff/status, make lint, make format-check, make reasons-lint and make branch-name-check are allowed.',
  'Try to find what is wrong. Only return pass=true if you looked hard and found no blocking issue. Every issue needs a concrete fix.',
].join('\n')

// The only reviewer allowed to run tests. It runs alone, never in parallel with another tester.
const TESTER_RULES = [
  'You are an independent, skeptical verifier in the deliver-story workflow, running alone.',
  'You are READ-ONLY for source: do not edit, create, delete, commit or push anything. You MAY run make targets, including make test.',
  'Report every failing command with its key output lines. pass=true only if everything is green.',
].join('\n')

// ======================================================================================
// helpers
// ======================================================================================
const results = []
const ctx = {
  storyId,
  target: TARGET,
  cardKey: null,
  branch: null,
  analysisPath: null,
  canvasPath: null,
  commit: null,
  prUrl: null,
  jiraStatus: null,
}

function absorb(res) {
  for (const k of [
    'cardKey',
    'branch',
    'analysisPath',
    'canvasPath',
    'commit',
    'prUrl',
    'jiraStatus',
  ]) {
    if (res[k]) ctx[k] = res[k]
  }
}

function stop(label, res) {
  throw new Error('STOP at ' + label + ' [' + res.status + ']: ' + (res.reason || res.summary))
}

// One main step. Throws (→ run stops) unless status is ok AND every required ctx key is set.
async function step(phaseTitle, label, prompt, requires) {
  const r = await agent(RULES + '\n\nContext so far: ' + JSON.stringify(ctx) + '\n\n' + prompt, {
    label,
    phase: phaseTitle,
    schema: STEP,
  })
  const res = r || { status: 'failed', summary: 'agent returned nothing (skipped or crashed)' }
  results.push({ step: label, ...res })
  absorb(res)
  log(label + ': ' + res.status + (res.reason ? ' (' + res.reason + ')' : ''))
  if (res.status !== 'ok') stop(label, res)
  for (const k of requires || []) {
    if (!ctx[k]) stop(label, { status: 'failed', reason: 'step returned ok but no ' + k })
  }
  return res
}

// Independent reviewers in parallel. Returns the blocking issues (empty = gate passed).
async function review(phaseTitle, gateName, lenses, rules) {
  const verdicts = await parallel(
    lenses.map(
      (l) => () =>
        agent(
          (rules || REVIEWER_RULES) +
            '\n\nContext: ' +
            JSON.stringify(ctx) +
            '\n\nLens "' +
            l.name +
            '": ' +
            l.prompt,
          { label: gateName + ':' + l.name, phase: phaseTitle, schema: VERDICT }
        )
    )
  )
  const blocking = []
  verdicts.forEach((v, i) => {
    if (!v) {
      blocking.push({
        lens: lenses[i].name,
        severity: 'blocking',
        detail: 'reviewer returned nothing',
      })
      return
    }
    for (const issue of v.issues || []) {
      if (issue.severity === 'blocking') blocking.push({ lens: lenses[i].name, ...issue })
    }
    if (!v.pass && !(v.issues || []).some((x) => x.severity === 'blocking')) {
      blocking.push({
        lens: lenses[i].name,
        severity: 'blocking',
        detail: 'pass=false without a listed blocking issue',
      })
    }
  })
  results.push({ step: gateName + ' review', blocking: blocking.length, issues: blocking })
  log(
    gateName + ' review: ' + (blocking.length ? blocking.length + ' blocking issue(s)' : 'passed')
  )
  return blocking
}

// Gate = review; on blocking issues run the revise step and review again, up to MAX_REVISIONS.
// Returns true if any revise step changed code. revisePrompt === null → no auto-repair (stop).
async function gate(phaseTitle, name, lenses, revisePrompt) {
  if (!VERIFY) return false
  let issues = await review(phaseTitle, name, lenses)
  let round = 0
  let codeChanged = false
  while (issues.length && revisePrompt !== null && round < MAX_REVISIONS) {
    round++
    const res = await step(
      phaseTitle,
      name + ' revise ' + round,
      revisePrompt +
        '\n\nIndependent reviewers raised these BLOCKING issues. Fix every one (SPDD rule: fix the canvas first when code and canvas diverge), commit with [' +
        storyId +
        '] messages, and report what you changed:\n' +
        JSON.stringify(issues, null, 2)
    )
    if (res.codeChanged) codeChanged = true
    issues = await review(phaseTitle, name + ' r' + round, lenses)
  }
  if (issues.length) {
    stop(name + ' gate', {
      status: 'blocked',
      reason:
        issues.length +
        ' blocking issue(s) remain' +
        (revisePrompt === null
          ? ' (no auto-repair for this gate)'
          : ' after ' + round + ' revision round(s)') +
        ': ' +
        issues.map((i) => '[' + i.lens + '] ' + i.detail).join(' | '),
    })
  }
  return codeChanged
}

// ---- reusable lens sets ------------------------------------------------------------------
const CODE_LENSES = [
  {
    name: 'correctness',
    prompt:
      'Review `' +
      DIFF +
      '` against ctx.canvasPath. Does the code implement every Operation and honour every Safeguard (exact status codes and error messages, transactions, atomicity, concurrency)? Reason about inputs that would break it; do not run tests.',
  },
  {
    name: 'norms',
    prompt:
      'Review `' +
      DIFF +
      '` for team norms: no `any`, routes never import Prisma, services own DB access, status changes + counters + audit in one transaction, no secrets or PII in logs, no unrelated refactors, no planted anti-patterns copied (admin.ts, /search).',
  },
  {
    name: 'tests',
    prompt:
      'Review the tests in `' +
      DIFF +
      '`. Is every AC and Safeguard covered by a test that would FAIL if the behaviour broke? Flag weak assertions, missing negative/edge cases, tests that call request(app) instead of api(), and tests that do not clean up their data.',
  },
]

async function sensorRecheck(round) {
  return review(
    'sensor',
    'sensor-recheck ' + round,
    [
      {
        name: 'independent-run',
        prompt:
          'Independently run: make branch-name-check, make reasons-lint, make format-check, make lint, and make test (run make test twice to catch flakiness). pass=true only if all are green both times.',
      },
    ],
    TESTER_RULES
  )
}

// ======================================================================================
// run
// ======================================================================================
try {
  // ---- 1. kickoff ------------------------------------------------------------------------
  await phase('kickoff')
  await step(
    'kickoff',
    'kickoff',
    'Follow kickoff.md for ' +
      storyId +
      (replica ? ' on replica card' : '') +
      (base ? ' --base ' + base : '') +
      '. If the base branch, the card to move, or uncommitted changes need a decision, return blocked. ' +
      'Return branch and cardKey (the card you moved).',
    ['branch', 'cardKey']
  )
  if (replica && ctx.cardKey === storyId) {
    stop('kickoff', {
      status: 'failed',
      reason: 'replica mode but the moved card is the original ' + storyId,
    })
  }
  if (!replica && ctx.cardKey !== storyId) {
    stop('kickoff', {
      status: 'failed',
      reason: 'expected card ' + storyId + ', got ' + ctx.cardKey,
    })
  }
  // Kickoff has Jira side effects: never re-run it automatically. Problems → stop for a human.
  await gate(
    'kickoff',
    'kickoff',
    [
      {
        name: 'state',
        prompt:
          'Verify: (1) the current git branch equals ctx.branch and passes `bash scripts/branch-name-check.sh`; ' +
          '(2) stories/<key>.md exists and copies every acceptance criterion and out-of-scope item from the Jira card (read it via the jira MCP); ' +
          '(3) card ctx.cardKey is In Progress, and in replica mode the original ' +
          storyId +
          ' was NOT moved.',
      },
    ],
    null
  )

  // ---- 2. spdd ---------------------------------------------------------------------------
  await phase('spdd')
  await step(
    'spdd',
    'spdd-analysis',
    'Run /spdd-analysis for ' +
      storyId +
      ' on branch ' +
      ctx.branch +
      ' (requirement = the Jira card ' +
      ctx.cardKey +
      '). Save it under spdd/analysis/. Do not ask to proceed to the canvas; return analysisPath. ' +
      'If the analysis finds the story already fully implemented, still return ok and say so in summary.',
    ['analysisPath']
  )
  await gate(
    'spdd',
    'analysis',
    [
      {
        name: 'ac-coverage',
        prompt:
          'Read ctx.analysisPath and the Jira card. Is the original requirement copied verbatim? Does the AC coverage table assess EVERY AC with a justified verdict? Flag any AC missing, misjudged, or marked addressable without grounding.',
      },
      {
        name: 'grounding',
        prompt:
          'Read ctx.analysisPath and check every claim about existing code against the actual files (schema, services, routes, app). Flag any concept, file, function or behaviour the analysis asserts that does not exist or behaves differently, and any obvious relevant code it missed.',
      },
    ],
    'Revise the analysis at ' + ctx.analysisPath + ' (same file). Do not touch code.'
  )
  await step(
    'spdd',
    'spdd-reasons-canvas',
    'Run /spdd-reasons-canvas with @' +
      ctx.analysisPath +
      ' as input. Resolve open questions with the analysis recommendations and list them as defaults in the canvas header. ' +
      'Save under spdd/prompt/, check it with bash scripts/reasons-lint.sh, and return canvasPath. Do not ask to implement.',
    ['canvasPath']
  )
  await gate(
    'spdd',
    'canvas',
    [
      {
        name: 'fidelity',
        prompt:
          'Read ctx.canvasPath, ctx.analysisPath and the Jira card. Does every AC map to at least one Operation and one Safeguard? Does the canvas add scope beyond the card, or contradict the analysis decisions? Is `bash scripts/reasons-lint.sh <canvas>` green?',
      },
      {
        name: 'implementability',
        prompt:
          'Read ctx.canvasPath against the codebase. Are Operations in a valid dependency order, test-first, with exact file paths, signatures and error messages that fit existing conventions (AGENT.md, api/CLAUDE.md, app/CLAUDE.md)? Flag anything ambiguous, impossible, or that breaks layering (routes must not import Prisma).',
      },
    ],
    'Revise the canvas at ' +
      ctx.canvasPath +
      ' (same file); re-run reasons-lint. Do not touch code.'
  )
  await step(
    'spdd',
    'spdd-generate',
    'Run /spdd-generate with @' +
      ctx.canvasPath +
      '. Follow Operations in order, test-first. Commit the SPDD artefacts and the code on ' +
      ctx.branch +
      ' with [' +
      storyId +
      '] messages through the hooks. If the canvas and code diverge, fix the canvas first. Return files and commit.',
    ['commit']
  )
  await gate(
    'spdd',
    'code',
    CODE_LENSES,
    'Fix the implementation of ' + storyId + ' per its canvas ' + ctx.canvasPath + '.'
  )

  // ---- 3. sensor -------------------------------------------------------------------------
  await phase('sensor')
  let sensorRound = 0
  let lastRecheck = []
  for (;;) {
    sensorRound++
    await step(
      'sensor',
      sensorRound === 1 ? 'sensor-and-fix' : 'sensor-and-fix ' + sensorRound,
      'Run /sensor-and-fix on ' +
        ctx.branch +
        '. Fix failures within its 3-attempt rule and commit fixes with [' +
        storyId +
        ']. Return ok only if every sensor is green; otherwise failed with the red sensor in reason.' +
        (lastRecheck.length
          ? '\n\nAn independent re-run (two make test runs) found these still red; fix them first:\n' +
            JSON.stringify(lastRecheck, null, 2)
          : '')
    )
    if (!VERIFY) break
    const recheck = await sensorRecheck(sensorRound)
    if (!recheck.length) break
    lastRecheck = recheck
    if (sensorRound > MAX_REVISIONS) {
      stop('sensor recheck', {
        status: 'blocked',
        reason:
          'independent re-run still red after ' +
          (sensorRound - 1) +
          ' revision round(s): ' +
          recheck.map((i) => i.detail).join(' | '),
      })
    }
  }

  // ---- 4. finish -------------------------------------------------------------------------
  await phase('finish')
  await step(
    'finish',
    'spdd-sync',
    'Run /spdd-sync @' +
      ctx.canvasPath +
      ' so the canvas matches the final code on ' +
      ctx.branch +
      '. Commit any canvas update with [' +
      storyId +
      ']. Return ok with "no changes" in summary if already in sync. Do not change code.'
  )
  const traceChangedCode = await gate(
    'finish',
    'traceability',
    [
      {
        name: 'completeness-critic',
        prompt:
          'Build an AC traceability table for the story: for EVERY acceptance criterion on the Jira card, name the code that implements it and the test that proves it (file:line). Also check the canvas (ctx.canvasPath) matches the final code after /spdd-sync. Any AC without both code and a test, or any canvas/code mismatch, is blocking.',
      },
    ],
    'Close the traceability gaps for ' +
      storyId +
      ' (canvas first, then tests; change code only if an AC is genuinely unimplemented).'
  )
  // Code changed after the code gate and sensors → review and re-check it before shipping.
  if (traceChangedCode) {
    log('traceability revise changed code: re-running code review and sensor re-check')
    await gate('finish', 'code (post-trace)', CODE_LENSES, null)
    const recheck = await sensorRecheck('post-trace')
    if (recheck.length) {
      stop('post-trace sensor recheck', {
        status: 'blocked',
        reason: recheck.map((i) => i.detail).join(' | '),
      })
    }
  }
  await step(
    'finish',
    'finish-dev',
    'Run /finish-dev ' +
      storyId +
      (replica ? ' on replica card' : '') +
      '. Push ' +
      ctx.branch +
      ', open the PR against ' +
      TARGET +
      (base ? ' (stacked PR: target the base branch, not main)' : '') +
      ', and move card ' +
      ctx.cardKey +
      ' to In Review. Slack is not authorized: do not block on it; put the paste-ready message in summary. Return prUrl, commit and jiraStatus.',
    ['prUrl', 'jiraStatus']
  )
  if (!/in review/i.test(ctx.jiraStatus)) {
    stop('finish-dev', {
      status: 'failed',
      reason: 'PR opened (' + ctx.prUrl + ') but card ' + ctx.cardKey + ' is ' + ctx.jiraStatus,
    })
  }
} catch (e) {
  return {
    storyId,
    outcome: 'stopped',
    stoppedAt: e.message,
    verify: VERIFY,
    context: ctx,
    steps: results,
  }
}

return { storyId, outcome: 'delivered', verify: VERIFY, context: ctx, steps: results }
