#!/usr/bin/env node
// Token lint: flags raw Tailwind values that bypass the design tokens
// (DESIGN.md "Tokens only"). Lab UI uses lab-* tokens, the hero uses t-*.
// A deliberate exception carries `ds-exception: <why>` on the same line or
// the line above. Canvas drawing code (ctx.fillStyle = '#fff') is not
// checked: the rules match Tailwind class syntax only.
//
//   node scripts/lint-tokens.mjs            every .tsx file under src/
//   node scripts/lint-tokens.mjs a.tsx b.tsx  only these files
//   node scripts/lint-tokens.mjs --hook       Claude Code PostToolUse hook:
//     reads the hook JSON on stdin, lints the edited file, and exits 2 with
//     the findings on stderr so the agent sees them right after its edit.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const RULES = [
  { re: /\btext-\[\d+(\.\d+)?px\]/, why: 'raw font size: use text-lab-* (lab) or the hero type scale' },
  { re: /\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|shadow)-(?:white|black)\/\d+/, why: 'raw white/black alpha: use a lab-* or t-* colour token' },
  { re: /\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/, why: 'Tailwind palette colour: use a lab-* or t-* token' },
  { re: /\b[\w-]+-\[[^\]]*(?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|oklch\()/, why: 'arbitrary colour value in a class: use a token' },
]

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : []
  })
}

const hook = process.argv.includes('--hook')
let args = process.argv.slice(2).filter((f) => f.endsWith('.tsx'))
if (hook) {
  let input = ''
  for await (const chunk of process.stdin) input += chunk
  let path = ''
  try { path = JSON.parse(input)?.tool_input?.file_path ?? '' } catch { /* not hook JSON: lint nothing */ }
  const rel = path ? relative(ROOT, path) : ''
  if (!rel.startsWith('src') || !rel.endsWith('.tsx')) process.exit(0)
  args = [path]
}
const files = args.length ? args.map((f) => join(ROOT, relative(ROOT, f))) : walk(join(ROOT, 'src'))

const hits = []
for (const file of files) {
  let text
  try { text = readFileSync(file, 'utf8') } catch { continue }
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (/ds-exception:/.test(line) || /ds-exception:/.test(lines[i - 1] ?? '')) return
    for (const { re, why } of RULES) {
      const m = re.exec(line)
      if (m) hits.push(`${relative(ROOT, file)}:${i + 1}  ${m[0]}  — ${why}`)
    }
  })
}

if (hits.length) {
  const out = `${hits.join('\n')}\n\nFAIL  token lint: ${hits.length} raw value(s). Use a token (DESIGN.md), or add "ds-exception: <why>" on the line or the line above.`
  if (hook) { console.error(out); process.exit(2) }
  console.log(out)
  process.exit(1)
}
if (hook) process.exit(0)
console.log(`PASS  token lint: ${files.length} file(s), no raw values`)
