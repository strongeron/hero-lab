# Client copy provenance review — Hero Lab

**Date:** 2026-11-22 · **Rev measured:** `ea63746` on `perf/single-pass-shader` (worktree `research-shader-options-ca8b39`) · **Type:** read-only review

> [!warning] This is not legal advice.
> This review traces where words and ideas came from. It does not decide who owns them.
> Whether client-derived work can be open-sourced depends on the Evil Martians ↔ AppSignal
> contract (IP assignment, confidentiality, portfolio clauses). Only the user and Evil Martians
> can read that contract. The questions to ask are at the end.

## Update — copy rewritten (2026-11-22, same day)

The user chose to **keep the monitoring-product idea and drop every JTBD/ICP phrase**. The
"Neutral replacement" column below is the first draft (lab-themed) and is superseded by this list.
Uncommitted on `perf/single-pass-shader`.

| Variant | Before | After |
|---|---|---|
| Broke / Fixed, Fine Grain, Full Bleed (+ `index.html` shell h1) | "Something broke. You should already know what." / "Errors, performance, and logs — one place. Five-minute install." | "A request just failed. The trace is already here." / "Stack traces, slow queries and timelines, side by side. One line to install." |
| Provocateur | sub "Errors, performance, and logs in one place. Five-minute install. No credit card." | "Full stack traces, request timelines and the query that set it off. One line to install." (headline and response kept: no match) |
| Value | "One tool. Every signal." / "…one place, one bill. Set up in five minutes." / "Your CFO will thank you." | "Fewer tabs. Clearer answers." / "Traces, latency and exceptions together, at a price that fits on one line." / "Your budget will notice." |
| Ship It | "Ship it. We're watching." / "…before your users notice. Five minutes to install." / "Know what broke before anyone else does." | "Ship on Friday. Sleep anyway." / "Every deploy gets a marker. New exceptions and slow endpoints link back to the commit that shipped them." / "Regressions point at their deploy." |
| AI | "Your AI built the app. Who's watching it run?" / "…Ask what happened in plain language, no dashboard required." / "We speak AI too." | "Prompted in a minute. Running for months." / "Ask why a request failed and get the trace, the slow query and the line that threw." / "Ask it like a teammate." |
| Speed | sub "Every exception, every slowdown, every log line — one place. Five-minute install. No credit card." | "Every exception and slow request, grouped and ranked by how many people it hits. One line to install." (headline and response kept: no match) |
| All CTAs | "Start free in 5 minutes" | "Try it free" |

Also: the 18 posters in `public/posters/` were re-baked from the live preview (headless Chrome,
`?preview=1&template=<id>`, same pixel sizes, each WebP encoded to its old byte size), and
`POSTER_VERSION` in `src/lab/TemplateGallery.tsx` went 4 → 5.

Verification:

```bash
# old phrases gone from the app
grep -rn -I -i -E "errors, performance|five.minute|5 minutes|no credit card|start free|one place|one tool|one bill|every signal|CFO|know what broke|before your users|anyone else|something broke|already know what|who's watching|we're watching|AI built|speak AI|dashboard required|plain language" src index.html
# → no output
# each new or kept phrase against the client research files
grep -r -i -F "<phrase>" ~/.claude/skills/synced/…/appsignal-jtbd
# → 0 for all 38 phrases; only the single common words "stack traces" and "budget" appear there
npm run typecheck   # → pass
npm run smoke       # → 27/27 (run before the last five lines were restored; copy-only change after)
```

Still true after the rewrite: old copy remains in public git history and old Netlify deploys
(see "Needs sign-off" item 4), and the contract questions below still apply.

## Status

Done. One fact changes the question: **the repo is already public.**
`gh repo view strongeron/hero-lab --json visibility` returns `"visibility":"PUBLIC"`, and the
showcase runs at `https://hero-lab.netlify.app/`. So the copy below is already published, in
the working tree, in the baked poster images and in git history. The real question is
"must we take it down or rewrite it", not "can we publish it".

## Findings — summary

1. The repo contains **no AppSignal name, logo, link or brand mark** in the tree or in any commit.
2. The **visual system is generic**: dither shader, palettes, ACME header, nav, fonts, motion names.
3. The **product copy in `copyVariants` follows the AppSignal homepage brief closely.**
   Three subheadlines match, almost word for word, an example in the user's `appsignal-jtbd`
   skill. That skill names client-internal sources: "AppSignal x Literally JTBD.pdf" and
   "GTM Strategy Ideal Customer Profile.pdf".
4. The copy is **not AppSignal's live public wording.** appsignal.com today says "Two-minute
   install", "Connect your app", "Free for 30 days". None of the Hero Lab exact phrases appear there.
5. The copy is **not in the local client repo checkout** (stale, 2026-04-27), except the generic
   "No credit card. Five-minute install." line that an AppSignal draft also used.
6. The **"Problem → Fix" story and the error/recovery log snippets** map to the brief's buying
   triggers (post-deploy regression, 4 AM incident). The idea is common in the monitoring
   category; the specific framing came from the client work.

Categories: **(a)** generic language anyone could write · **(b)** close to AppSignal's public
positioning · **(c)** apparently from internal client material (playground drafts, JTBD/ICP research).

## Inventory table

All lines refer to `src/heroes/dither/ditherStore.ts` unless named otherwise.

| Item | file:line | Cat. | Evidence | Neutral replacement |
|---|---|---|---|---|
| Sub: "Errors, performance, and logs — one place. Five-minute install." (Fine Grain, Full Bleed, Broke/Fixed) | :118, :152, :282 | **c** | `appsignal-jtbd/icp-criteria.md:213-214`: "Errors, performance, and logs in one tool. … Five-minute install. No credit card." Live site says "Two-minute install" and lists more signals. | "Shaders, type and motion — one lab. Tune it live." |
| Sub: "Errors, performance, and logs in one place. Five-minute install. No credit card." (Provocateur) | :176 | **c** | Same source, nearly verbatim; the JTBD file lists "5-min install, no credit card" as need N5 and differentiator D2 (`jtbd-criteria.md:58, :92`). | "Every parameter on a slider. Every look in a URL." |
| Sub: "Errors, performance, and logs in one place. Ask what happened in plain language, no dashboard required." (AI) | :223 | **c** | Maps to differentiator D7 "MCP / AI-native. Dashboard optional" (`jtbd-criteria.md:97`). An earlier history version said "Query it in plain language. No dashboard required." | "Describe the look in plain words. The panel does the rest." |
| Sub: "Errors, performance, and logs — one place, one bill. Set up in five minutes." (Value) | :191 | **c** | Maps to the consolidation + cost UVP "Three tools in one, at a tenth of the cost, up and running in five minutes" (`jtbd-criteria.md:67`). | "One shader, every breakpoint. Set up in minutes." |
| Sub: "Every exception, every slowdown, every log line — one place. Five-minute install. No credit card." (Speed) | :267 | **c** | Same three signals + same friction claims as the brief. | "Every tile, every frame, every breakpoint — one panel." |
| Sub: "Every deploy tracked. Every error caught. Every slowdown flagged — before your users notice. Five minutes to install." (Ship It) | :206 | **c** | Mirrors "Know before your users do" (`icp-criteria.md:212`) and trigger T2 "Post-deploy regression" (`icp-criteria.md:100`). | "Every state previewed. Every breakpoint checked — before you ship." |
| Response: "Know what broke before anyone else does." | :207 | **c** | Brief rule: "Lead with the job … 'Know what broke'" (`jtbd-criteria.md:137`) and example headline "Know what broke. … Know before your users do." | "See it before anyone else does." |
| Headline: "Something broke. You should already know what." (default; also inline in `index.html`) | :117, :151, :281; `index.html:81` | **c** (idea) / a (words) | Words are not in the brief or on the live site. The angle matches persona P4 copy test "you vibe coded your first app and something broke" (`jtbd-criteria.md:37`) and pain line "Your app broke and you're flying blind" (`:158`). | "Make the background do the talking." |
| Headline: "Your AI built the app. Who's watching it run?" + response "We speak AI too." | :220, :224; baked into `public/posters/problem-*.webp` | **c** (idea) | Persona P4 "AI-Powered / Vibe Coder" + MCP angle (`jtbd-criteria.md:33-39`). Words are original. | "Your AI wrote the page. Who's art-directing it?" / "Prompt it, then tune it." |
| Headline: "One tool. Every signal." | :190 | **b/c** | Live site: "One tool for errors, performance, logs, …". Client repo `apps/com` uses "in one tool" and a v2 `SignalNarrative` section; brief uses "Signal Pillars". | "One field. Every state." |
| Response: "Your CFO will thank you." | :192 | **c** (idea) | Persona P3 "Technical Founder / CTO / Optimizer", cost-cutting JTBD (`jtbd-criteria.md:24-31`). Words are original. | "Your designer will thank you." |
| Headline: "Ship it. We're watching." | :205 | a/c | Generic phrase; aimed at trigger T2. | "Ship it. It still looks right." |
| Headline: "Every error tells a story. Most tools miss the plot." + "We read every line." | :175, :177 | a/c | Generic monitoring language; no match in the brief, the live site or the client repo. Aimed at the same ICP. | "Every pixel tells a story. Most heroes miss the plot." / "We tuned every tile." |
| Headline: "Errors fall. We catch." + "See everything. Fix it fast." | :266, :268 | a | No match found. "fix", "fast" are in the brief's word palette (`jtbd-criteria.md:145-153`), which is standard copywriting advice. | "Tiles fall. Type holds." |
| Response: "Caught everything. Start at line 42." | :119, :153, :283 | a | No match in the brief, the live site or the client repo. | Keep, or "Start at frame one." |
| CTA: "Start free in 5 minutes" (all variants) | :120, :154, :178, :193, :208, :225, :269, :284; posters | **c** | Exact CTA of the VALIDATE worked example in `appsignal-jtbd/SKILL.md:124`. Live site CTA is "Connect your app"; live install claim is 2 minutes. | "Open the lab" / "Try it live" |
| Removed CTA "Link your app" and headlines "What the duck just happened?", "WTF" | git history only (`git log -p -- src/heroes/dither/ditherStore.ts`) | a/b | "Link your app" is close to AppSignal's live "Connect your app". Still readable in public history. | n/a (history) |
| Variant labels: Fine Grain, Full Bleed, Provocateur, Value, Ship It, AI, Speed, Broke / Fixed | :116–:280 | a | Descriptive layout and tone names. "Value", "Speed", "AI" echo the brief's UVP names (Cost, Speed, Consolidation) but are common words. | Keep |
| Hover snippets: "TypeError: cart is undefined", "N+1 · 342 queries · /orders", "uncaught: nil.email · user#show", recovery lines | :624–:646 | a | Invented sample log lines. `nil.email` and `user#show` read Ruby/Rails, AppSignal's core stack (`icp-criteria.md:51`), but these are standard Rails idioms. | Keep, or swap `nil.email` for `null.email` |
| Motion names: Error Sweep, Falling (`falling-errors`), Radar, Orbit, Breath… | :712–:972; README:46 | a | No match in the brief, the live site or the client repo (`git grep -i "Error Sweep"` → 0). | Keep, or rename "Error Sweep" → "Diagonal Sweep" |
| Palettes: Signal, Ember, Ultra, Mono, Prism, Aurora (hex values) | :1387–:1406 | a | Generic names; pink→teal "problem→fix" pairs. Brand hex not compared: AppSignal CSS was not fetched. "Signal" also echoes AppSignal's name and "signals" vocabulary. | Rename "Signal" → "Mint" to be safe |
| Header: ACME, nav (Platform, AI Workflows, DevTools, Docs, Changelog, Pricing), "Sign in", "Launch sandbox" | `src/content/presets.ts:21-31` | a | Neutral placeholder by design (spec `docs/specs/2026-07-13-hero-lab.md:28-35`). | Keep |
| Comment "ACME caught it" | :588 | a | Internal code comment, neutral brand. | Keep |
| `index.html` meta, OG image, favicon | `index.html:8-30`; `public/og-image.jpg` | a | About Hero Lab only; no product copy. | Keep |
| Posters with baked copy | `public/posters/*.webp` | follows copy | `problem-desktop-half.webp` shows the AI headline, sub and "START FREE IN 5 MINUTES". Rewriting the strings needs regenerated posters. | Regenerate after copy change |
| Spec text "client branding", "client copy", "client skin", codenames `wild`, `magicpath` | `docs/specs/2026-07-13-hero-lab.md:28-35, :88, :100, :115` | — | Says in public that client copy exists and was meant to be stripped. Names no client. | Reword to "demo copy" |
| "Problem → Fix" story, pink-error / green-recovery reveal | GLOSSARY.md:3, :46; README:33 | a/c | Common pattern in monitoring marketing. It serves the brief's triggers T2/T3. Treat the concept as general; the AppSignal-specific copy above as client-derived. | Keep the mechanic; neutral copy |

## Clearly safe

- The engine and lab: shader, tile field, Design Panel, Layers, templates, URL params, posters' visuals.
- The ACME header, nav labels, "Launch sandbox", the OG card, `index.html` meta.
- Fonts (all third-party open fonts, credited per the README) and palette hex values.
- Motion preset names, variant labels, sample log snippets (optionally rename "Signal", "Error Sweep").

## Needs sign-off (user + Evil Martians, possibly AppSignal)

1. **All `sub` lines with "Errors, performance, and logs" + "Five-minute install" + "No credit card"** (category c). They copy the client research example nearly verbatim.
2. **The CTA "Start free in 5 minutes"** (category c). Exact CTA from the client brief's worked example.
3. **Persona-shaped headlines/responses** ("Your AI built the app…", "Your CFO will thank you", "Ship it. We're watching", "Know what broke before anyone else does", "One tool. Every signal."). The words are original; the angles come from the JTBD/ICP research.
4. **Public git history.** Rewriting HEAD leaves every string in history and in old Netlify deploys. If sign-off says "remove", history needs a rewrite (e.g. `git filter-repo`) and a force push, or a fresh repo.

Lowest-risk path without waiting: replace every category-c string with the neutral copy above, regenerate posters, and reword the spec's "client" lines. The demo then sells Hero Lab, not a monitoring product.

## Questions to ask

For Evil Martians (contract owner):

1. Does the AppSignal contract assign IP in work product to AppSignal, including drafts and internal explorations never delivered?
2. Does the confidentiality clause cover client research (the Literally JTBD study, the GTM ICP document) and copy derived from it?
3. Was the Hero Lab hero (or its "Wild 01/02" predecessor) made on AppSignal billable time or with AppSignal-funded research?
4. Does the contract allow portfolio or open-source use of techniques and generic components made during the engagement?
5. Is a public repo that already contains this copy acceptable, or must it be removed, rewritten, or history-scrubbed?

For the user:

6. Was the copy written from the JTBD/ICP documents, or before them? (The `appsignal-jtbd` skill is dated from a Feb 11, 2026 PDF; Hero Lab's first commit is 2026-07-16.)
7. Did the "Wild" playground live in an AppSignal or Evil Martians repo, and who could see it?
8. Should Hero Lab keep a monitoring-product demo at all, or switch to copy about the lab itself?

For AppSignal (only if Evil Martians says the contract needs it):

9. Do you object to generic monitoring copy inspired by the homepage work appearing in an Evil Martians open-source demo with no AppSignal name?

## Evidence — commands run

Working tree (worktree, rev `ea63746`):

```bash
grep -rn -i -E "appsignal|client|jtbd|\bICP\b|line 42|five-minute|5 minutes|acme|credit card|CFO|sentry|datadog|honeybadger|new relic" . \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude=package-lock.json -I
# → no "appsignal", "sentry", "datadog", "honeybadger", "new relic" hits; "client" only in vite types,
#   getClientRects, and docs/specs/2026-07-13-hero-lab.md:28-115
grep -n -E "label|headline:|sub:|response:|cta:" src/heroes/dither/ditherStore.ts
cat src/content/presets.ts
sed -n 9,27p index.html; grep -n "<h1>" index.html
```

Git history (all refs, 93 commits):

```bash
git log --all --oneline -S AppSignal      # → nothing
git log --all --oneline -S appsignal      # → nothing
git log --all --oneline -i -G appsignal   # → nothing
git log --all --format='%h %s' | grep -i -E 'appsignal|client'   # → nothing
git log --all --oneline -S magicpath      # → eeec54f (spec only)
git log --all -p -- src/heroes/dither/ditherStore.ts | grep -E '^[-+]\s+(headline|sub|response|cta|label):'
git log --all --format='%h' -- src/content/presets.ts   # every version: brand 'ACME' only
gh repo view strongeron/hero-lab --json visibility,isPrivate   # → PUBLIC
```

Client research skill (read only to compare):

```bash
J=~/.claude/skills/synced/0dbfb909-…/appsignal-jtbd   # SKILL.md, icp-criteria.md, jtbd-criteria.md
grep -rn -i -E 'broke|already know|line 42|five.minute|5 minutes|one place|errors, performance|credit card|CFO|one bill|ship it|watching|AI built|plain language|no dashboard|before your users' "$J"
# → icp-criteria.md:212-214, SKILL.md:124, jtbd-criteria.md:19,37,58,67,92,97,137,158,168
```

Local client repo (`~/Evil Martians/appsignal-prod/appsignal-web`, branch `gretchenfitze/updated-main-page-v3`, last commit 2026-04-27 — stale, may not reflect what shipped later):

```bash
git grep -n -I -i -F "<phrase>"   # for each Hero Lab phrase
# → 0 hits: "line 42", "Errors, performance, and logs", "Start free in 5 minutes", "We're watching",
#   "Errors fall", "tells a story", "Know what broke", "Error Sweep", "Broke / Fixed", "cart is undefined"
# → generic hits only: "Something broke" (blog code samples), "already know what" (blog), "Link your app" (docs)
git log --all -F -S "Five-minute install" -- apps/com
# → 9d82960a (2026-04-02) added "Free for 30 days. No credit card. Five-minute install."; f0cd5680 (2026-04-22) removed it
```

Public site (fetched 2026-11-22, `https://www.appsignal.com/` and `/pricing`):

- Homepage: "One tool for errors, performance, logs, uptime, hosts, cron jobs, and dashboards." Install: "2 minutes".
- Pricing hero: "Make your next crash make sense." / "Free for 30 days. No credit card. Two-minute install." / CTA "Connect your app".
- Not found on either page: "Something broke", "already know what", "Start free in 5 minutes", "Five-minute install", "Errors, performance, and logs", "We're watching", "Your CFO".
- Brand colours: not compared (CSS not fetched).

## Open questions

- AppSignal brand hex values were not compared with the palettes. A follow-up can fetch the site CSS.
- The local client repo is 7 months stale. A current `appsignal-web` pull may show more overlap (or less).
- The original "Wild" playground repo was not located or searched; it may hold more client-derived material that never reached Hero Lab.
