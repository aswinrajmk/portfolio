import { Layout, type SectionRef } from "../shared/Layout";
import { Decisions } from "./sections/Decisions";
import { Evidence } from "./sections/Evidence";
import { JiraAgent } from "./sections/JiraAgent";
import { Pipeline } from "./sections/Pipeline";
import { Requirements } from "./sections/Requirements";
import { RunStrip } from "./sections/RunStrip";
import { Strategy } from "./sections/Strategy";
import { Upcoming } from "./sections/Upcoming";

const SECTIONS: SectionRef[] = [
  { id: "latest-run", title: "Latest pipeline run" },
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
      <Requirements index={2} />
      <JiraAgent index={3} />
      <Evidence index={4} />
      <Pipeline index={5} />
      <Strategy index={6} />
      <Decisions index={7} />
      <Upcoming index={8} />
    </Layout>
  );
}
