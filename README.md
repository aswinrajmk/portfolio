# portfolio

QA engineering portfolio for Aswin Raj, hosted on Cloudflare Workers.

- `/`: profile page built from the resume (experience, skills, credentials, contact).
- `/dashboard/`: QA dashboard showing evidence of practical skill. Run data is labelled **Sample data**
  until the results API exists (roadmap phase 2).

Every pull request gets its own preview deployment and a Playwright smoke run against it.
Merging to `main` deploys to production and runs the same suite there.

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
BASE_URL=https://aswin-qa.<subdomain>.workers.dev npm test  # production
```

## Where to edit content

All copy lives in [`src/content/site.ts`](src/content/site.ts): profile, experience, skills, evidence
statuses, pipeline stages, strategy notes and decisions. Rules:

- Do not mark a skill `live` without an `evidence` link (a smoke test enforces this).
- Items with `draft: true` show a Draft label until reviewed.
- Mock run data lives in `src/data/sample.ts` and always renders with a Sample data badge.

## Deploy flow

| Event                        | What runs (`.github/workflows/`)                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| PR opened or updated         | `ci.yml`: lint, type-check, build → `wrangler preview --name pr-<n>` → comment the preview URL on the PR → smoke suite against the preview |
| PR closed or merged          | `ci.yml`: `wrangler preview delete --name pr-<n>`                                                                                          |
| Push to `main`               | `deploy.yml`: lint, type-check, build → `wrangler deploy` → smoke suite against production (asserts no noindex)                            |
| Manual (`workflow_dispatch`) | `deploy.yml`, for redeploying production                                                                                                   |

Forked PRs only run lint, type-check and build, because GitHub does not give them secrets.
Worker Previews are in open beta on Cloudflare. The free plan allows 100 previews per Worker, and
cleanup on close keeps this repo well under that.

## Required secrets

Two GitHub repository secrets. They are never committed and never needed locally.

| Secret                  | What it is                                                       |
| ----------------------- | ---------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Custom API token, permissions below                              |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID (not secret, but kept with the token) |

Token permissions, scoped to your account only:

| Type    | Permission       | Access |
| ------- | ---------------- | ------ |
| Account | Workers Scripts  | Edit   |
| Account | Account Settings | Read   |
| User    | User Details     | Read   |
| User    | Memberships      | Read   |

No zone permissions are needed because the site uses the workers.dev URL.

### Step by step

**1. Make sure a workers.dev subdomain exists**

1. Sign in at https://dash.cloudflare.com.
2. In the left sidebar open **Workers & Pages**.
3. If asked to choose a workers.dev subdomain, pick one. It becomes part of every URL
   (`aswin-qa.<subdomain>.workers.dev`) and is hard to change later.

**2. Copy your account ID**

1. Still in **Workers & Pages**, find **Account details** on the right.
2. Click the copy button next to **Account ID**. Keep it for step 4.
   (Alternative: press Cmd+K in the dashboard, type "Copy account ID", press Enter.)

**3. Create the API token**

1. Click the profile icon (top right), then **My Profile**, then **API Tokens** in the left menu.
2. Click **Create Token**.
3. Scroll to **Custom token** and click **Get started**.
4. **Token name**: `github-actions-portfolio`.
5. Under **Permissions**, add four rows (use **+ Add more** for each new row):
   - `Account` · `Workers Scripts` · `Edit`
   - `Account` · `Account Settings` · `Read`
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

## Project rules

See [CLAUDE.md](CLAUDE.md): synthetic data only, no secrets in git, and anything not backed by a
real pipeline run is labelled Sample data or Planned.
