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
- wealthlite: the app under test (Worker + D1 + static UI)
- qa-tests: Playwright + TypeScript framework (created in a later phase)

## Roadmap (tick off as completed)
- [x] 1. Landing page + Cloudflare hosting + CI deploy + PR previews
- [ ] 2. Results API (Worker + D1 + R2) and dashboard reading real data
- [ ] 3. Playwright + API test framework, running in CI against previews
- [ ] 4. Custom reporter posting results to the Results API
- [ ] 5. Telegram bot (natural-language tools, YES confirmation for start_run)
- [ ] 6. Appium + WDIO mobile run
- [ ] 7. AI agents: failure triage, test generation (Playwright MCP), AI Gateway cost cap
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
- Run data stays Sample data until phase 2 ships the Results API.
