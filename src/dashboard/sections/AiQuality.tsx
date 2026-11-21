import { getAiQuality, type AiQualityResponse } from "../../data";
import { Section } from "../../shared/Layout";
import { formatDate } from "../../shared/runs";
import { usePolled } from "../../shared/usePolled";

const load = () => getAiQuality();
const nextDelay = () => 120_000;
const EVALS = "https://github.com/aswinrajmk/wealthlite/tree/main/automation/evals";
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${Math.round(n * 10) / 10}%`);

export function AiQuality({ index }: { index: number }) {
  const data = usePolled<AiQualityResponse | null>(load, nextDelay);
  return (
    <Section id="ai-quality" index={index} title="AI quality: are the AI-written tests good enough?">
      <p className="lede">
        I don't approve AI output by eye alone. Every draft is scored for criteria coverage, duplicates,
        self-contradictions and completeness, and a set of 20 golden stories gates every prompt or model change in CI.
        Scores are deterministic checks, so the same draft always gets the same score.{" "}
        <a href={EVALS}>How the evals work</a>
      </p>
      {data === undefined ? (
        <p className="note">Loading AI quality…</p>
      ) : data === null ? (
        <p className="note">The Results API could not be reached, so AI quality is unavailable right now.</p>
      ) : (
        <>
          <Tiles data={data} />
          <Weakest data={data} />
          <Engines data={data} />
          <Recent data={data} />
        </>
      )}
    </Section>
  );
}

function Tiles({ data }: { data: AiQualityResponse }) {
  const g = data.golden.latest;
  const previous = data.golden.trend.at(-2);
  const tiles = [
    {
      label: "Golden-set score",
      value: pct(g?.mean),
      detail: g ? `${g.model}, prompt v${g.promptVersion}, ${formatDate(g.at)}` : "No golden run recorded yet",
      href: g?.runUrl ?? undefined,
    },
    {
      label: "Change vs previous run",
      value:
        g && previous
          ? `${g.mean - previous.mean >= 0 ? "+" : ""}${Math.round((g.mean - previous.mean) * 10) / 10}`
          : "–",
      detail: "CI fails a change that drops more than 5 points",
    },
    {
      label: "Live drafts scored",
      value: String(data.live.count),
      detail:
        (data.live.average === null ? "none in 90 days" : `average ${pct(data.live.average)}`) +
        (data.live.storyIssues ? ` · ${data.live.storyIssues} left out: story had no acceptance criteria` : ""),
    },
  ];
  return (
    <dl className="run__stats kpis">
      {tiles.map((t) => (
        <div key={t.label} className="run__stat kpi">
          <dt>{t.label}</dt>
          <dd>
            <span className="kpi__value num">{t.value}</span>
            <span className="kpi__detail">{t.href ? <a href={t.href}>{t.detail}</a> : t.detail}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Weakest({ data }: { data: AiQualityResponse }) {
  const per = Object.entries(data.golden.latest?.perStory ?? {})
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3);
  if (!per.length) return null;
  return (
    <p className="note">
      Weakest golden stories, where the prompt needs work next:{" "}
      {per.map(([key, score], i) => (
        <span key={key}>
          {i ? ", " : ""}
          <a href={`${EVALS}/golden/${key}.json`}>{key}</a> {score}%
        </span>
      ))}
      .
    </p>
  );
}

function Engines({ data }: { data: AiQualityResponse }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Automation by engine">
      <table className="matrix">
        <caption>Who wrote the automated tests, and how often it worked</caption>
        <thead>
          <tr>
            <th scope="col">Engine</th>
            <th scope="col">Runs</th>
            <th scope="col">PR ready</th>
            <th scope="col">Draft PR (needed a fix)</th>
            <th scope="col">Failed</th>
          </tr>
        </thead>
        <tbody>
          {data.automation.map((e) => (
            <tr key={e.engine}>
              <th scope="row">{e.engine === "claude" ? "Claude Code" : "Local model (Qwen)"}</th>
              <td className="num">{e.runs}</td>
              <td className="num">{e.prOpened}</td>
              <td className="num">{e.draft}</td>
              <td className="num">{e.failed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Recent({ data }: { data: AiQualityResponse }) {
  if (!data.live.recent.length) return null;
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Recent live draft scores">
      <table className="matrix">
        <caption>Recent drafts, scored before I approved them</caption>
        <thead>
          <tr>
            <th scope="col">Story</th>
            <th scope="col">Score</th>
            <th scope="col">Findings</th>
          </tr>
        </thead>
        <tbody>
          {data.live.recent.map((d) => (
            <tr key={`${d.storyKey}${d.at}`}>
              <th scope="row">{d.storyKey}</th>
              <td className="num">{d.storyIssue ? <span title={d.storyIssue}>story issue</span> : pct(d.score)}</td>
              <td>{d.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
