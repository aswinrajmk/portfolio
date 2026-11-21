# portfolio

QA engineering portfolio for Aswin Raj, hosted on Cloudflare Workers.

- `/`: profile page built from the resume (experience, skills, credentials, contact).
- `/dashboard/`: QA dashboard. It shows real test runs against [WealthLite](https://github.com/aswinrajmk/wealthlite),
  streamed live by [qa-tests](https://github.com/aswinrajmk/qa-tests), and falls back to labelled
  **Sample data** only when no run is stored.
- `/dashboard/run/?id=…`: live run report with healed locators, errors, steps, logs and failure screenshots.

Every pull request gets its own preview deployment. Merging to `main` deploys to production.
The Playwright smoke suite runs on demand (see "Run the smoke suite in CI" below).

## Stack

Vite + React + TypeScript, plain CSS with custom properties, `@cloudflare/vite-plugin`, and one Worker
(`worker/index.ts`) that serves the static pages, sets security headers, adds `X-Robots-Tag: noindex`
on previews, and reserves `/api/*` for later phases. Tests use Playwright and axe-core.

## Run locally

Requires Node 22.

```sh
npm install
npm run dev          # http://localhost:5173 with hot reload (runs the Worker in workerd)
npm run build        # production build into dist/
npm run preview      # serve the production build at http://localhost:4173
npm run lint         # ESLint + Prettier check
npm run typecheck
npx playwright install chromium   # once
npm test             # builds, serves on :4173 and runs the smoke suite
```

Run the suite against any deployed URL:

```sh
BASE_URL=https://<preview-url> EXPECT_NOINDEX=1 npm test   # a preview
BASE_URL=https://portfolio.aswin-qa.workers.dev npm test       # production
```

## Where to edit content

All copy lives in [`src/content/site.ts`](src/content/site.ts): profile, experience, skills, evidence
statuses, pipeline stages, strategy notes and decisions. Rules:

- Do not mark a skill `live` without an `evidence` link (a smoke test enforces this).
- Items with `draft: true` show a Draft label until reviewed.
- Mock run data lives in `src/data/sample.ts` and renders, with a Sample data badge, only when the API has no runs.

## Results API

The Worker serves the API under `/api/*`, backed by D1 (`portfolio-results`; PR previews use
`portfolio-results-preview`). The schema is in `migrations/`, and the shared types and validation are in
`shared/results.ts`.

| Route                                       | Auth                                        | Purpose                                                     |
| ------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| `POST /api/runs`                            | `Authorization: Bearer <RESULTS_API_TOKEN>` | Start a run                                                 |
| `POST /api/runs/:id/results`                | bearer                                      | Add one test result, with an optional base64 JPEG (≤200 KB) |
| `POST /api/runs/:id/finish`                 | bearer                                      | Finish. The status comes from the stored results            |
| `GET /api/runs?project=&limit=`             | none                                        | Recent runs (the limit is capped at 50)                     |
| `GET /api/runs/latest`, `GET /api/runs/:id` | none                                        | Run summary, or a run with its tests                        |
| `GET /api/results/:id/screenshot`           | none                                        | Failure screenshot (`image/jpeg`)                           |
| `GET /api/requirements`                     | none                                        | Jira stories (KAN) with linked tests and results            |
| `GET /api/health`                           | none                                        | `{ ok, environment }`                                       |

`RESULTS_API_TOKEN` is a GitHub secret here, and CI copies it to the Worker on every deploy. The
qa-tests repo holds the same value. Locally, `npm run dev` and `npm test` create `.dev.vars` with a random
token and migrate local D1. The API tests write only to local D1.

## Deploy flow

| Event                        | What runs (`.github/workflows/`)                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| PR opened or updated         | `ci.yml`: lint, type-check, build → `wrangler preview --name pr-<n>` → comment the preview URL on the PR |
| PR closed or merged          | `ci.yml`: `wrangler preview delete --name pr-<n>`                                                        |
| Push to `main`               | `deploy.yml`: lint, type-check, build → `wrangler deploy`                                                |
| Manual (`workflow_dispatch`) | `deploy.yml`, for redeploying production                                                                 |

### Run the smoke suite in CI

Tests are manual for now so they never block a merge or deploy. In GitHub: **Actions** → **Smoke tests** →
**Run workflow**, then set **target** to `production` or a PR number (for example `3`). A PR number tests that
PR's preview and also checks the `X-Robots-Tag: noindex` header. The HTML report is attached to the run.

Forked PRs only run lint, type-check and build, because GitHub does not give them secrets.
Worker Previews are in open beta on Cloudflare. The free plan allows 100 previews per Worker, and
cleanup on close keeps this repo well under that.

## Required secrets

Three GitHub repository secrets. They are never committed and never needed locally.

| Secret                  | What it is                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Custom API token, permissions below                                                      |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID (not secret, but kept with the token)                         |
| `RESULTS_API_TOKEN`     | Write token for the Results API (copied to the Worker on deploy; same value in qa-tests) |

Token permissions, scoped to your account only:

| Type    | Permission       | Access |
| ------- | ---------------- | ------ |
| Account | Workers Scripts  | Edit   |
| Account | Account Settings | Read   |
| Account | D1               | Edit   |
| User    | User Details     | Read   |
| User    | Memberships      | Read   |

No zone permissions are needed because the site uses the workers.dev URL.

### Step by step

**1. Make sure a workers.dev subdomain exists**

1. Open https://dash.cloudflare.com/?to=/:account/workers-and-pages
   (sidebar: **Compute** → **Workers & Pages**).
2. If asked to choose a workers.dev subdomain, pick one. Otherwise it is listed under **Account details**.
   This account's subdomain is `aswin-qa`, so production is `https://portfolio.aswin-qa.workers.dev`
   and previews are `pr-<n>-portfolio.aswin-qa.workers.dev`.

**2. Copy your account ID**

1. Press Cmd+K (or click **Quick search** in the sidebar), type `Copy account ID`, press Enter.
2. Backup: it is the long hex string in the address bar right after `dash.cloudflare.com/`.

**3. Create the API token**

1. Open https://dash.cloudflare.com/profile/api-tokens (profile icon, top right → **My Profile** → **API Tokens**).
   Use this user token page, not **Manage account → Account API tokens**: account tokens cannot hold the
   `User` permissions below.
2. Click **Create Token**.
3. Scroll to **Custom token** and click **Get started**.
4. **Token name**: `github-actions-portfolio`.
5. Under **Permissions**, add five rows (use **+ Add more** for each new row):
   - `Account` · `Workers Scripts` · `Edit`
   - `Account` · `Account Settings` · `Read`
   - `Account` · `D1` · `Edit`
   - `User` · `User Details` · `Read`
   - `User` · `Memberships` · `Read`
6. Under **Account Resources**: `Include` · your account (not "All accounts").
7. Leave **Client IP Address Filtering** empty (GitHub runner IPs change).
8. **TTL**: optional. If you set an end date, add a reminder to rotate the token before it expires.
9. Click **Continue to summary**, check the list matches step 5, then click **Create Token**.
10. Copy the token now. Cloudflare shows it only once. Do not paste it anywhere except GitHub (step 4).

**4. Add both secrets to GitHub**

1. Open https://github.com/aswinrajmk/portfolio/settings/secrets/actions
   (repo → **Settings** → **Secrets and variables** → **Actions**).
2. Click **New repository secret**. Name: `CLOUDFLARE_API_TOKEN`. Secret: the token from step 3. **Add secret**.
3. Click **New repository secret** again. Name: `CLOUDFLARE_ACCOUNT_ID`. Secret: the ID from step 2. **Add secret**.
4. You should now see both names listed under **Repository secrets**. GitHub hides the values.

**If a deploy fails with an authentication or permission error**, the Wrangler log in the failed
Actions step names the missing permission. Edit the token (My Profile → API Tokens → ⋯ → Edit),
add that one permission, and re-run the job. The token value does not change when you edit it.

## Telegram bot

A private Telegram bot, served by this Worker at `POST /telegram/webhook`, gives the owner control from a phone:

- **Ask about runs in plain language**, for example "Why did the copy test fail?". Claude (`claude-opus-5`) answers
  with read-only tools over the Results API data.
- **Change code in any of the three repos.** For example, "Rename the sign-in button to Log in" asks for **YES**.
  The repo's `claude-change.yml` workflow then has Claude Code make the change on a branch. The workflow (not
  Claude) runs the checks, pushes and opens a PR, and calls back `POST /api/bot/events`. The bot sends the PR
  link and files.
- **Merge or close PRs and start QA runs.** Each one needs YES. Merging is refused until every check passes.
  PRs that touch `.github/`, wrangler config, migrations or `package.json` need **MERGE ANYWAY**.
- **Run reports:** every finished run is posted to a Telegram channel, with the first failure screenshot.
- **Requirements:** `/reqs` (or "which requirements are failing?") shows coverage per Jira story, and
  `/run @KAN-10` runs only that story's tests (`/run @smoke` runs a suite).

## Requirements coverage

Requirements are Jira stories in project `KAN`. Each qa-tests test is tagged with its story on the describe
block and its Jira Test issue on the test (`@KAN-10`, `@KAN-11`), and the reporter sends the tags with each
result (`tags` on a result, `filter` on a partial run; migration `0003`). `GET /api/requirements` joins the
stories (Jira search API, cached 5 minutes per isolate) with each test's latest result, grouped by its first
Jira tag, which is always the story because Playwright lists inherited tags first. Results older than the
latest full-suite run (unfiltered, or `@smoke|@regression`) are ignored, so renamed tests drop out. Worker
secrets `JIRA_SITE`, `JIRA_EMAIL` and `JIRA_TOKEN` (read-only use) are needed. Without them the matrix still
lists tagged tests, with no titles.

Safety:

- Only the owner's Telegram user ID is answered, and the webhook needs Telegram's secret token header.
- The model never sees tokens and cannot act on its own. Gated tools only create a pending action
  (10-minute expiry), which Worker code runs after YES.
- The bot's GitHub token has no Workflows permission, so bot changes can never alter CI.

Shortcuts work without Anthropic API credit: `/latest`, `/runs`, `/reqs`, `/run [filter]`,
`/merge <repo> <number>`, `/pending`, `/reset`, `/help`. Free-form messages need API credit; if it runs out,
the bot says so instead of a generic error. Setup is one interactive script, run by the
owner in a terminal: `npm run bot:setup`. It checks each token, stores it as a Worker or GitHub secret without
printing it, and registers the webhook. Bot code is in `worker/bot/`. Local tests (`tests/smoke/bot.spec.ts`)
run against a stub of Telegram, GitHub and Anthropic (`tests/bot/stub-server.mjs`).

## Project rules

See [CLAUDE.md](CLAUDE.md): synthetic data only, no secrets in git, and anything not backed by a
real pipeline run is labelled Sample data or Planned.
