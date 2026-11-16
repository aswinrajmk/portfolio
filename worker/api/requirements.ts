import type { Requirement, RequirementsResponse, RequirementState, RequirementTest } from "../../shared/results";
import { requirementResults } from "./store";

// Requirements are GitHub issues labelled "requirement" in the app repo. Tests link to them with a tag
// such as "@REQ-3". This joins the two so the dashboard can show requirement → tests → latest result.

interface Issue {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  pull_request?: unknown;
}

const ISSUE_CACHE_MS = 5 * 60 * 1000;
// Per-isolate cache. The Cache API does nothing on workers.dev, and GitHub's limits are generous with a token.
let cached: { at: number; issues: Issue[] } | null = null;

async function requirementIssues(env: Env, repo: string): Promise<Issue[] | null> {
  if (cached && Date.now() - cached.at < ISSUE_CACHE_MS) return cached.issues;
  const e = env as unknown as Record<string, string | undefined>;
  const api = (e.GITHUB_API_BASE || "https://api.github.com").replace(/\/$/, "");
  const owner = e.GITHUB_OWNER || "aswinrajmk";
  try {
    const response = await fetch(`${api}/repos/${owner}/${repo}/issues?labels=requirement&state=all&per_page=100`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "portfolio-results-api",
        ...(e.GITHUB_BOT_TOKEN ? { Authorization: `Bearer ${e.GITHUB_BOT_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
    const issues = ((await response.json()) as Issue[]).filter((i) => !i.pull_request);
    cached = { at: Date.now(), issues };
    return issues;
  } catch (e) {
    console.warn(`[requirements] could not read issues: ${String(e)}`);
    return cached?.issues ?? null;
  }
}

function stateOf(tests: RequirementTest[]): RequirementState {
  if (tests.length === 0) return "untested";
  return tests.some((t) => t.status === "failed") ? "failing" : "passing";
}

export async function listRequirements(env: Env, project: string): Promise<RequirementsResponse> {
  const [issues, results] = await Promise.all([requirementIssues(env, project), requirementResults(env.DB, project)]);
  const byNumber = new Map<number, Requirement>();
  for (const issue of issues ?? []) {
    const tests = results.get(issue.number) ?? [];
    byNumber.set(issue.number, {
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      issueState: issue.state,
      state: stateOf(tests),
      tests,
    });
  }
  // Tags without a matching issue still show, so a missing or mistyped requirement is visible.
  for (const [number, tests] of results) {
    if (byNumber.has(number)) continue;
    byNumber.set(number, { number, title: "", url: null, issueState: null, state: stateOf(tests), tests });
  }
  return {
    requirements: [...byNumber.values()].sort((a, b) => a.number - b.number),
    issuesLoaded: issues !== null,
  };
}
