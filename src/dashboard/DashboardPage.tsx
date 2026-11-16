import { Layout, type SectionRef } from "../shared/Layout";
import { Decisions } from "./sections/Decisions";
import { Evidence } from "./sections/Evidence";
import { Pipeline } from "./sections/Pipeline";
import { RunStrip } from "./sections/RunStrip";
import { Strategy } from "./sections/Strategy";
import { Upcoming } from "./sections/Upcoming";

const SECTIONS: SectionRef[] = [
  { id: "latest-run", title: "Latest pipeline run" },
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
          This site is its own test subject. Every pull request gets its own preview deployment, and a Playwright smoke
          suite runs against it on demand. Each item below says whether it is live or planned.
        </p>
      </header>
      <RunStrip index={1} />
      <Evidence index={2} />
      <Pipeline index={3} />
      <Strategy index={4} />
      <Decisions index={5} />
      <Upcoming index={6} />
    </Layout>
  );
}
