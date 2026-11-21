import type { Requirement, RequirementsResponse, RequirementState, RequirementTest } from "../../shared/results";
import { jiraBase, jiraSearch } from "./jira";
import { requirementResults } from "./store";

// Requirements are Jira stories in project KAN. qa-tests tags each test with its story ("@KAN-6") and its Jira
// Test issue. This joins stories and results so the dashboard can show story → tests → latest result.

interface Story {
  key: string;
  title: string;
  url: string;
  done: boolean;
}

const STORY_CACHE_MS = 5 * 60 * 1000;
const JQL = "project = KAN AND issuetype = Story ORDER BY key ASC";
// Per-isolate cache. The Cache API does nothing on workers.dev, and Jira's limits are generous for this.
let cached: { at: number; stories: Story[] } | null = null;

async function stories(env: Env): Promise<Story[] | null> {
  if (cached && Date.now() - cached.at < STORY_CACHE_MS) return cached.stories;
  const base = jiraBase(env);
  if (!base) {
    console.warn("[requirements] JIRA_SITE, JIRA_EMAIL or JIRA_TOKEN is not set");
    return null;
  }
  try {
    const issues = await jiraSearch(env, JQL, ["summary", "status"]);
    const list = issues.map((i) => ({
      key: i.key,
      title: i.fields.summary ?? "",
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
