import { jiraAgent } from "../../content/site";
import { Section } from "../../shared/Layout";
import { StatusBadge } from "../../shared/StatusBadge";
import { PipelineDiagram } from "../PipelineDiagram";

const DIAGRAM_TITLE = "Flow from a new Jira story to approved Jira Test issues and automated Playwright tests";

export function JiraAgent({ index }: { index: number }) {
  const { stages, steps, tools, example, source } = jiraAgent;
  return (
    <Section
      id="jira-agent"
      index={index}
      title="Jira to automated tests: AI agents with approvals"
      aside={<StatusBadge status="live" />}
    >
      <p className="lede">
        When a new story is created in Jira, a self-hosted n8n workflow picks it up. A local AI agent (Ollama running
        Qwen) reviews the requirement and drafts a minimal set of test cases, which become Jira Test issues linked to
        the story. When I label a case smoke or regression, Claude Code (or, without a subscription, the local model)
        writes the Playwright test for it in a pull request. I approve every step in Telegram. Analysis and test design
        stay on my own machine. Only the Claude option sends the story and its approved cases to a cloud AI.
      </p>
      <PipelineDiagram className="diagram diagram--wide" columns={4} stages={stages} title={DIAGRAM_TITLE} />
      <PipelineDiagram className="diagram diagram--narrow" columns={1} stages={stages} title={DIAGRAM_TITLE} />

      <h3 className="agent__subhead">Step by step</h3>
      <ol className="agent-steps">
        {steps.map((step) => (
          <li key={step.title} className="agent-steps__item">
            <h4>{step.title}</h4>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>

      <h3 className="agent__subhead">Tools and skills used</h3>
      <dl className="agent-tools">
        {tools.map((tool) => (
          <div key={tool.name} className="agent-tools__item">
            <dt>{tool.name}</dt>
            <dd>{tool.detail}</dd>
          </div>
        ))}
      </dl>

      <h3 className="agent__subhead">From a real run</h3>
      <article className="agent-example" aria-label="Example from a real run">
        <p className="agent-example__story">
          <span className="agent-example__label">Story</span> {example.story}
        </p>
        <ul className="agent-example__criteria">
          {example.criteria.map((criterion) => (
            <li key={criterion}>{criterion}</li>
          ))}
        </ul>
        <dl>
          <dt>The agent flagged</dt>
          <dd>{example.flagged}</dd>
          <dt>Approved test cases</dt>
          <dd>
            <ol>
              {example.cases.map((testCase) => (
                <li key={testCase}>{testCase}</li>
              ))}
            </ol>
          </dd>
          <dt>Why the approvals matter</dt>
          <dd>{example.review}</dd>
          <dt>Automated</dt>
          <dd>
            {example.automated} <a href={example.automatedLink.href}>{example.automatedLink.label}</a>
          </dd>
        </dl>
      </article>
      <p className="agent__source">
        <a href={source.href}>{source.label}</a>
      </p>
    </Section>
  );
}
