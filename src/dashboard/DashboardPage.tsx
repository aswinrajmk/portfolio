import { Layout, type SectionRef } from "../shared/Layout";
import { Decisions } from "./sections/Decisions";
import { Evidence } from "./sections/Evidence";
import { JiraAgent } from "./sections/JiraAgent";
import { Metrics } from "./sections/Metrics";
import { Pipeline } from "./sections/Pipeline";
import { Requirements } from "./sections/Requirements";
import { RunStrip } from "./sections/RunStrip";
import { Strategy } from "./sections/Strategy";
import { Upcoming } from "./sections/Upcoming";

const SECTIONS: SectionRef[] = [
  { id: "latest-run", title: "Latest pipeline run" },
  { id: "metrics", title: "Quality metrics and release readiness" },
  { id: "requirements", title: "Requirements coverage" },
  { id: "jira-agent", title: "Jira to automated tests: AI agents with approvals" },
  { id: "evidence", title: "Skills and evidence" },
  { id: "pipeline", title: "Pipeline architecture" },
  { id: "strategy", title: "Test strategy" },
  { id: "decisions", title: "Decisions" },
  { id: "upcoming", title: "AI agents and leadership" },
];

export function DashboardPage() {
  return (
    <Layout page="dashboard" sections={SECTIONS}>
      <header className="page-intro">
        <p className="eyebrow">QA dashboard</p>
        <h1>How I work, in public</h1>
        <p className="lede">
          WealthLite is a small demo wealth app with synthetic data. Every time it deploys, a Playwright smoke suite
          runs against it, the full regression suite runs nightly, and each result streams here as it finishes. When a
          locator breaks, the suite tries to heal it, and always reports what it healed. A second flow turns Jira
          stories into reviewed test cases with a local AI agent (n8n, Ollama and Qwen), and Claude Code (or the local
          model) automates the ones I label. Each item below says whether it is live or planned.
        </p>
      </header>
      <RunStrip index={1} />
      <Metrics index={2} />
      <Requirements index={3} />
      <JiraAgent index={4} />
      <Evidence index={5} />
      <Pipeline index={6} />
      <Strategy index={7} />
      <Decisions index={8} />
      <Upcoming index={9} />
    </Layout>
  );
}
