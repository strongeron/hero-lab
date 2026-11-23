#!/usr/bin/env node
// `npm run check`: every validation in order, one summary line per step.
// All steps run even after a failure, so one run shows everything that broke.
// See docs/validation.md.

import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, dirname, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env, PATH: `${join(ROOT, 'node_modules/.bin')}${delimiter}${process.env.PATH}`, FORCE_COLOR: '0', NO_COLOR: '1' }

// Vendored from the ai-design-system skill (scripts/design-system/), so the
// contract checks run in CI and on any machine.
const contractScript = join(ROOT, 'scripts/design-system/check-contract.mjs')
const indexScript = join(ROOT, 'scripts/design-system/generate-indexes.mjs')
const contractFiles = (dirName) => {
  const dir = join(ROOT, 'design-system', dirName)
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => `design-system/${dirName}/${f}`) : []
}
// One step per contract kind: the checker validates location and inventory
// against the kind it is given.
const contractSteps = [['component', 'components', 'COMPONENTS'], ['layout', 'layouts', 'LAYOUTS'], ['pattern', 'patterns', 'PATTERNS']]
  .filter(([, dirName]) => contractFiles(dirName).length)
  .map(([kind, dirName, index]) => ({
    name: `design-system ${dirName}`,
    cmd: process.execPath,
    args: [contractScript, '--kind', kind, '--inventory', `design-system/${index}.md`, ...contractFiles(dirName)],
  }))
const noSmoke = process.argv.includes('--no-smoke') ? [] : null

const steps = [
  { name: 'typecheck (tsc -b)', cmd: 'tsc', args: ['-b'] },
  { name: 'build (vite build)', cmd: 'vite', args: ['build'] },
  { name: 'token lint', cmd: process.execPath, args: [join(ROOT, 'scripts/lint-tokens.mjs')] },
  ...contractSteps,
  { name: 'design-system indexes', cmd: process.execPath, args: [indexScript, '--check', '.'] },
  ...(noSmoke ?? [{ name: 'smoke (headless browser)', cmd: process.execPath, args: [join(ROOT, 'scripts/smoke.mjs')] }]),
]

/** Run a command, echo its output, resolve with its exit code and output. */
function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    const tee = (d) => { out += d; process.stdout.write(d) }
    child.stdout.on('data', tee)
    child.stderr.on('data', tee)
    child.on('error', (e) => resolve({ code: 1, out: `cannot start ${cmd}: ${e.message}` }))
    child.on('close', (code) => resolve({ code: code ?? 1, out }))
  })
}

/** The first line that names the problem (most specific pattern first),
 *  else the last line printed. */
function reason(out) {
  const lines = out.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const re of [/^FAIL\b/, /error TS\d+/, /^\[vite\]|^Error: /, /\berror\b|not ok/i]) {
    const hit = lines.find((l) => re.test(l))
    if (hit) return hit
  }
  return lines.at(-1) ?? 'no output'
}

const summary = []
const t0 = Date.now()
for (const s of steps) {
  console.log(`\n── ${s.name} ──`)
  if (s.skip) {
    console.log(`WARN  skipped: ${s.skip}`)
    summary.push(`WARN  ${s.name} — skipped: ${s.skip}`)
    continue
  }
  const start = Date.now()
  const { code, out } = await run(s.cmd, s.args)
  const secs = ((Date.now() - start) / 1000).toFixed(1)
  summary.push(code === 0 ? `PASS  ${s.name}  (${secs}s)` : `FAIL  ${s.name} — ${reason(out)}  (${secs}s)`)
}

const failed = summary.filter((l) => l.startsWith('FAIL')).length
console.log(`\n── check summary (${((Date.now() - t0) / 1000).toFixed(1)}s) ──\n${summary.join('\n')}`)
console.log(failed ? `\ncheck: ${failed} step(s) failed` : '\ncheck: all steps passed')
process.exit(failed ? 1 : 0)
