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
- [ ] 1. Landing page + Cloudflare hosting + CI deploy + PR previews
- [ ] 2. Results API (Worker + D1 + R2) and dashboard reading real data
- [ ] 3. Playwright + API test framework, running in CI against previews
- [ ] 4. Custom reporter posting results to the Results API
- [ ] 5. Telegram bot (natural-language tools, YES confirmation for start_run)
- [ ] 6. Appium + WDIO mobile run
- [ ] 7. AI agents: failure triage, test generation (Playwright MCP), AI Gateway cost cap
- [ ] 8. Email Routing (needs a domain), fault-injection suite, case studies, polish
