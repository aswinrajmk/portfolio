import { Layout, type SectionRef } from "../shared/Layout";
import { Decisions } from "./sections/Decisions";
import { Evidence } from "./sections/Evidence";
import { Pipeline } from "./sections/Pipeline";
import { Requirements } from "./sections/Requirements";
import { RunStrip } from "./sections/RunStrip";
import { Strategy } from "./sections/Strategy";
import { Upcoming } from "./sections/Upcoming";

const SECTIONS: SectionRef[] = [
  { id: "latest-run", title: "Latest pipeline run" },
  { id: "requirements", title: "Requirements coverage" },
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
          WealthLite is a small demo wealth app with synthetic data. Every time it deploys, a Playwright suite runs
          against it and streams each result here as it finishes. When a locator breaks, the suite tries to heal it, and
          always reports what it healed. Each item below says whether it is live or planned.
        </p>
      </header>
      <RunStrip index={1} />
      <Requirements index={2} />
      <Evidence index={3} />
      <Pipeline index={4} />
      <Strategy index={5} />
      <Decisions index={6} />
      <Upcoming index={7} />
    </Layout>
  );
}
