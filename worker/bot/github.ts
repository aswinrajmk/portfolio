// GitHub REST calls the bot makes on the owner's behalf. Only Worker code calls these; the model never sees the token.
import type { Repo } from "./config";

export interface PrSummary {
  number: number;
  title: string;
  url: string;
  state: "open" | "closed";
  merged: boolean;
  headSha: string;
  files: string[];
  checks: { total: number; pending: string[]; failed: string[]; passed: number };
}

// Paths whose changes need a second confirmation before merging (deploy pipeline, infra, data schema).
const SENSITIVE = [/^\.github\//, /^wrangler.*\.jsonc?$/, /^migrations\//, /^package(-lock)?\.json$/];

export const sensitiveFiles = (files: string[]) => files.filter((f) => SENSITIVE.some((re) => re.test(f)));

export class GitHub {
  constructor(
    private readonly token: string,
    private readonly owner: string,
    private readonly api = "https://api.github.com",
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.api}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "portfolio-qa-bot",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub ${method} ${path} failed (${response.status}): ${text.slice(0, 300)}`);
    }
    return (response.status === 204 ? null : await response.json()) as T;
  }

  dispatch(repo: Repo, workflow: string, inputs: Record<string, string>) {
    return this.request("POST", `/repos/${this.owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
      ref: "main",
      inputs,
    });
  }

  async listOpenPrs(repo: Repo) {
    const prs = await this.request<{ number: number; title: string; html_url: string; user: { login: string } }[]>(
      "GET",
      `/repos/${this.owner}/${repo}/pulls?state=open&per_page=20`,
    );
    return prs.map((p) => ({ number: p.number, title: p.title, url: p.html_url, author: p.user.login }));
  }

  async pr(repo: Repo, number: number): Promise<PrSummary> {
    const base = `/repos/${this.owner}/${repo}`;
    const pr = await this.request<{
      number: number;
      title: string;
      html_url: string;
      state: "open" | "closed";
      merged: boolean;
      head: { sha: string };
    }>("GET", `${base}/pulls/${number}`);
    const [files, runs] = await Promise.all([
      this.request<{ filename: string }[]>("GET", `${base}/pulls/${number}/files?per_page=100`),
      this.request<{ check_runs: { name: string; status: string; conclusion: string | null }[] }>(
        "GET",
        `${base}/commits/${pr.head.sha}/check-runs?per_page=100`,
      ),
    ]);
    const pending = runs.check_runs.filter((c) => c.status !== "completed").map((c) => c.name);
    const failed = runs.check_runs
      .filter((c) => c.status === "completed" && !["success", "skipped", "neutral"].includes(c.conclusion ?? ""))
      .map((c) => c.name);
    return {
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      state: pr.state,
      merged: pr.merged,
      headSha: pr.head.sha,
      files: files.map((f) => f.filename),
      checks: {
        total: runs.check_runs.length,
        pending,
        failed,
        passed: runs.check_runs.length - pending.length - failed.length,
      },
    };
  }

  merge(repo: Repo, number: number, sha: string) {
    // `sha` makes GitHub refuse the merge if new commits arrived after the owner confirmed.
    return this.request("PUT", `/repos/${this.owner}/${repo}/pulls/${number}/merge`, { merge_method: "squash", sha });
  }

  close(repo: Repo, number: number) {
    return this.request("PATCH", `/repos/${this.owner}/${repo}/pulls/${number}`, { state: "closed" });
  }
}
