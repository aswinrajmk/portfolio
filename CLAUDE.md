# Portfolio: project rules

## Goal
A recruiter-facing QA engineering portfolio for Aswin (senior QA automation engineer, ~8 years,
wealth-management domain, leads a small QA team; stack: Playwright + TypeScript, Appium + WDIO).
It is a live dashboard showing evidence of practical skill, not a static CV page.
Hosted on Cloudflare Workers (static assets). No custom domain yet; use the workers.dev URL.

## Rules
- Never commit secrets. Tokens live in GitHub secrets, Worker secrets, or a gitignored .dev.vars.
- Synthetic data only. No employer or client data, ever.
- Stay within Cloudflare free-tier limits.
- Honesty rule: anything not backed by a real pipeline run must be labelled "Sample data" or
  "Planned" in the UI. Never present mock numbers as live results.
- Check current Cloudflare docs before using Wrangler commands or config keys; the tooling changes.
- Small commits with clear messages. Run build, lint, and tests before every commit.
- Production is indexable. Preview deployments must send X-Robots-Tag: noindex.

## Related repos (separate)
- wealthlite (github.com/aswinrajmk/wealthlite): the app under test, https://wealthlite.aswin-qa.workers.dev
- qa-tests (github.com/aswinrajmk/qa-tests): Playwright + TypeScript framework, self-healing, live reporter

## Roadmap (tick off as completed)
- [x] 1. Landing page + Cloudflare hosting + CI deploy + PR previews
- [x] 2–4. Live demo loop (merged phases): Results API (Worker + D1) with live run reports, WealthLite app,
  qa-tests framework with rule-based self-healing and a custom reporter, triggered by every app deploy.
  R2 (traces, HTML reports) deferred; it needs a payment method on the Cloudflare account.
- [x] 5. Telegram bot (natural-language tools, YES confirmation for start_run), plus requirement-driven test drafting
- [ ] 6. Appium + WDIO mobile run
- [ ] 7. AI agents: failure triage, AI-assisted healing, test generation (Playwright MCP), AI Gateway cost cap
- [ ] 8. Email Routing (needs a domain), fault-injection suite, case studies, polish

## Phase 1 summary (2026-11-16)
Built a two-page site on one Cloudflare Worker (`portfolio`, production https://portfolio.aswin-qa.workers.dev):
`/` is the profile page built from the resume, `/dashboard/` is the QA dashboard (latest-run strip labelled
Sample data, skills/evidence matrix, pipeline diagram, draft strategy notes and ADRs, planned AI/leadership).
All copy lives in `src/content/site.ts`; run data comes from `src/data/` (`getLatestRun()`, source "sample").
The Worker serves static assets, sets CSP and security headers, adds `X-Robots-Tag: noindex` when
`ENVIRONMENT` is not "production" (set to "preview" via the `previews` block in `wrangler.jsonc`), and
stubs `/api/*`. CI: each PR gets a Worker Preview (`wrangler preview --name pr-<n>`, URL commented on the
PR); previews are deleted on close; pushes to `main` deploy production. The 21-test Playwright + axe smoke
suite runs only on manual trigger (`smoke.yml`, target "production" or a PR number) at Aswin's request, so
tests never block early-stage merges. Lighthouse on the PR #1 preview: accessibility 100,
best practices 100, performance 98–100 (warm; one cold-start mobile run scored 87).

Open issues:
- Worker Previews are in open beta; Wrangler prints progress before its `--json` output (CI parses from the first `{`).
- `run_worker_first: true` makes every request a Worker invocation (fine within the free 100k/day).
- Test strategy notes and the three ADRs are drafts awaiting Aswin's review; leadership content needs specifics.
- ~~Run data stays Sample data until phase 2 ships the Results API.~~ Done in phases 2–4.

## Phases 2–4 summary: live demo loop (2026-11-16)
Push to wealthlite main → its CI deploys (Worker + D1, PBKDF2 passwords, HMAC session cookie) and sends
`repository_dispatch` (`wealthlite-deployed`) to qa-tests → the Playwright suite (12 tests: UI flows, API,
copy, axe; plus 5 `node --test` unit tests for healing) runs and its custom reporter streams each result to
`POST /api/runs/:id/results` here → `/dashboard/` and `/dashboard/run/?id=` update live (2 s polling).
Self-healing is rule-based (primary locator → test id → form structure → text similarity with synonyms);
healed tests are their own status with a suggested locator, never a plain pass. Failure screenshots are
JPEGs (≤200 KB) stored in D1. Rehearsed on production: renaming "Sign in" to "Log in" gave 8 passed,
3 healed, 1 failed (copy test, with screenshot) about 80 s after the push; reverting gave 12/12 green.

Open issues:
- Run order in a report is completion order (tests run in parallel), not file order.
- Runs left "running" for 30+ minutes show as "incomplete"; there is no cleanup job or retention policy yet.
- QA_DISPATCH_TOKEN in wealthlite is a fine-grained PAT that expires; renew it before expiry.
- Pipeline diagram and evidence statuses in `src/content/site.ts` now describe the demo loop.

## Phase 5 summary: Telegram bot and requirements coverage (2026-11-16)
The portfolio Worker hosts a private Telegram bot (`worker/bot/`): Claude (`claude-opus-5`) answers run
questions with read-only tools; code changes, merges, closes and QA runs only create a pending action that
Worker code runs after YES (MERGE ANYWAY for PRs touching CI, wrangler, migrations or package files). Code
changes run `claude-change.yml` in the target repo (Claude Code edits; the workflow commits and opens the PR).
Finished runs are posted to a Telegram channel with the first failure screenshot. Shortcut commands (`/latest`,
`/runs`, `/reqs`, `/run [filter]`, `/merge`) need no AI credit.
Requirements are wealthlite issues labelled `requirement` (#1–#4 seeded from existing behaviour). Editing one
triggers qa-tests `requirement.yml`: Claude Code drafts `@REQ-<n>` tests, runs them against live WealthLite,
opens a PR and reports counts to Telegram. The dashboard's requirements matrix (`GET /api/requirements`) shows
each requirement with its linked tests' latest results. n8n was considered and rejected: it needs paid or
self-managed hosting and duplicates GitHub Actions plus the bot.

Open issues:
- Free-form bot messages need Anthropic API credit (the owner's balance ran out on 2026-11-16).
- Leadership specifics and impact numbers are still missing from the profile; they must come from Aswin.
- Performance testing (k6) is not shown anywhere yet.
