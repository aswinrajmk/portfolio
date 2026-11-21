import type { Requirement, RequirementsResponse, RequirementState, RequirementTest } from "../../shared/results";
import { requirementResults } from "./store";

// Requirements are Jira stories in project KAN. qa-tests tags each test with its story ("@KAN-6") and its Jira
// Test issue. This joins stories and results so the dashboard can show story → tests → latest result.

interface Story {
  key: string;
  title: string;
  url: string;
  done: boolean;
}

interface JiraSearch {
  issues: { key: string; fields: { summary: string; status?: { statusCategory?: { key?: string } } } }[];
}

const STORY_CACHE_MS = 5 * 60 * 1000;
const JQL = "project = KAN AND issuetype = Story ORDER BY key ASC";
// Per-isolate cache. The Cache API does nothing on workers.dev, and Jira's limits are generous for this.
let cached: { at: number; stories: Story[] } | null = null;

/** Jira base URL from JIRA_API_BASE (tests point it at the stub) or JIRA_SITE ("x.atlassian.net" or a URL). */
function jiraBase(e: Record<string, string | undefined>): string | null {
  const raw = e.JIRA_API_BASE || e.JIRA_SITE;
  if (!raw) return null;
  return (raw.startsWith("http") ? raw : `https://${raw}`).replace(/\/$/, "");
}

async function stories(env: Env): Promise<Story[] | null> {
  if (cached && Date.now() - cached.at < STORY_CACHE_MS) return cached.stories;
  const e = env as unknown as Record<string, string | undefined>;
  const base = jiraBase(e);
  if (!base || !e.JIRA_EMAIL || !e.JIRA_TOKEN) {
    console.warn("[requirements] JIRA_SITE, JIRA_EMAIL or JIRA_TOKEN is not set");
    return null;
  }
  try {
    const params = new URLSearchParams({ jql: JQL, fields: "summary,status", maxResults: "100" });
    const response = await fetch(`${base}/rest/api/3/search/jql?${params}`, {
      headers: { Accept: "application/json", Authorization: `Basic ${btoa(`${e.JIRA_EMAIL}:${e.JIRA_TOKEN}`)}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Jira responded ${response.status}`);
    const body = (await response.json()) as JiraSearch;
    const list = body.issues.map((i) => ({
      key: i.key,
      title: i.fields.summary,
      url: `${base}/browse/${i.key}`,
      done: i.fields.status?.statusCategory?.key === "done",
    }));
    cached = { at: Date.now(), stories: list };
    return list;
  } catch (err) {
    console.warn(`[requirements] could not read Jira stories: ${String(err)}`);
    return cached?.stories ?? null;
  }
}

function stateOf(tests: RequirementTest[]): RequirementState {
  if (tests.length === 0) return "untested";
  return tests.some((t) => t.status === "failed") ? "failing" : "passing";
}

const keyNumber = (key: string) => Number(key.split("-")[1]);

export async function listRequirements(env: Env, project: string): Promise<RequirementsResponse> {
  const [list, results] = await Promise.all([stories(env), requirementResults(env.DB, project)]);
  const byKey = new Map<string, Requirement>();
  for (const story of list ?? []) {
    const tests = results.get(story.key) ?? [];
    byKey.set(story.key, {
      key: story.key,
      title: story.title,
      url: story.url,
      issueState: story.done ? "closed" : "open",
      state: stateOf(tests),
      tests,
    });
  }
  // Tags without a matching story still show, so a missing or mistyped story key is visible.
  for (const [key, tests] of results) {
    if (byKey.has(key)) continue;
    byKey.set(key, { key, title: "", url: null, issueState: null, state: stateOf(tests), tests });
  }
  return {
    requirements: [...byKey.values()].sort((a, b) => keyNumber(a.key) - keyNumber(b.key)),
    issuesLoaded: list !== null,
  };
}
