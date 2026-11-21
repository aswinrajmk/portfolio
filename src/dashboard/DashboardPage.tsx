import { Layout } from "../shared/Layout";
import { Decisions } from "./sections/Decisions";
import { Evidence } from "./sections/Evidence";
import { JiraAgent } from "./sections/JiraAgent";
import { Metrics } from "./sections/Metrics";
import { Pipeline } from "./sections/Pipeline";
import { Requirements } from "./sections/Requirements";
import { RunStrip } from "./sections/RunStrip";
import { Strategy } from "./sections/Strategy";
import { Upcoming } from "./sections/Upcoming";
import { TabBar, TabPanel, useHashTab, type TabDef } from "./Tabs";

// Four views instead of one long page. Section ids stay as they were, so older links such as /dashboard/#metrics
// (Telegram, readiness reasons, shared URLs) open the tab that holds the section and scroll to it.
const TABS: TabDef[] = [
  {
    id: "overview",
    label: "Overview",
    sections: [
      { id: "readiness", title: "Release readiness" },
      { id: "latest-run", title: "Latest pipeline run" },
    ],
  },
  {
    id: "quality",
    label: "Quality",
    sections: [
      { id: "metrics", title: "Quality metrics and release readiness" },
      { id: "requirements", title: "Requirements coverage" },
    ],
  },
  {
    id: "ai-workflow",
    label: "AI workflow",
    sections: [
      { id: "jira-agent", title: "Jira to automated tests: AI agents with approvals" },
      { id: "pipeline", title: "Pipeline architecture" },
    ],
  },
  {
    id: "how-i-work",
    label: "How I work",
    sections: [
      { id: "evidence", title: "Skills and evidence" },
      { id: "strategy", title: "Test strategy" },
      { id: "decisions", title: "Decisions" },
      { id: "upcoming", title: "AI agents and leadership" },
    ],
  },
];

function Panel({ tab }: { tab: string }) {
  switch (tab) {
    case "quality":
      return (
        <>
          <Metrics index={1} />
          <Requirements index={2} />
        </>
      );
    case "ai-workflow":
      return (
        <>
          <JiraAgent index={1} />
          <Pipeline index={2} />
        </>
      );
    case "how-i-work":
      return (
        <>
          <Evidence index={1} />
          <Strategy index={2} />
          <Decisions index={3} />
          <Upcoming index={4} />
        </>
      );
    default:
      return (
        <>
          <Metrics index={1} variant="summary" />
          <RunStrip index={2} compact />
        </>
      );
  }
}

export function DashboardPage() {
  const active = useHashTab(TABS);
  const current = TABS.find((t) => t.id === active) ?? TABS[0];
  return (
    <Layout page="dashboard" sections={current && current.sections.length > 1 ? current.sections : []}>
      <header className="page-intro">
        <p className="eyebrow">QA dashboard</p>
        <h1>How I work, in public</h1>
        <p className="lede">
          Live quality data for WealthLite, a demo wealth app with synthetic data: smoke tests on every deploy,
          regression nightly, Jira traceability, and AI agents that draft and automate tests with my approval at every
          step.
        </p>
      </header>
      <TabBar tabs={TABS} active={active} />
      {/* Only the active panel is mounted, so polled sections fetch only while they are visible. */}
      <TabPanel id={active}>
        <Panel tab={active} />
      </TabPanel>
    </Layout>
  );
}
