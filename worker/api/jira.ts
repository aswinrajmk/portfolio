// Minimal Jira Cloud search client shared by requirements coverage and metrics. Credentials are Worker secrets
// (JIRA_SITE, JIRA_EMAIL, JIRA_TOKEN); tests point JIRA_API_BASE at the local stub server.

export interface JiraIssue {
  key: string;
  fields: {
    summary?: string;
    labels?: string[];
    status?: { statusCategory?: { key?: string } };
  };
}

/** Jira base URL from JIRA_API_BASE or JIRA_SITE ("x.atlassian.net" or a URL); null when not configured. */
export function jiraBase(env: Env): string | null {
  const e = env as unknown as Record<string, string | undefined>;
  const raw = e.JIRA_API_BASE || e.JIRA_SITE;
  if (!raw || !e.JIRA_EMAIL || !e.JIRA_TOKEN) return null;
  return (raw.startsWith("http") ? raw : `https://${raw}`).replace(/\/$/, "");
}

/** Runs a JQL search (up to 100 issues). Throws when Jira is not configured or does not answer. */
export async function jiraSearch(env: Env, jql: string, fields: string[]): Promise<JiraIssue[]> {
  const base = jiraBase(env);
  if (!base) throw new Error("JIRA_SITE, JIRA_EMAIL or JIRA_TOKEN is not set");
  const e = env as unknown as Record<string, string>;
  const params = new URLSearchParams({ jql, fields: fields.join(","), maxResults: "100" });
  const response = await fetch(`${base}/rest/api/3/search/jql?${params}`, {
    headers: { Accept: "application/json", Authorization: `Basic ${btoa(`${e.JIRA_EMAIL}:${e.JIRA_TOKEN}`)}` },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Jira responded ${response.status}`);
  return ((await response.json()) as { issues: JiraIssue[] }).issues;
}
