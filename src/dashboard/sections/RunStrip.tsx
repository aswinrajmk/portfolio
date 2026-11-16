import { useEffect, useState } from "react";
import { getLatestRun, totals, type RunSummary } from "../../data";
import { Section } from "../../shared/Layout";
import { Tag } from "../../shared/StatusBadge";

const OUTCOME_LABEL: Record<RunSummary["outcome"], string> = {
  passed: "Passed",
  failed: "Failed",
  running: "Running",
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function RunStrip({ index }: { index: number }) {
  const [run, setRun] = useState<RunSummary | null>(null);

  useEffect(() => {
    let active = true;
    void getLatestRun().then((result) => {
      if (active) setRun(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const isSample = run?.source === "sample";

  return (
    <Section
      id="latest-run"
      index={index}
      title="Latest pipeline run"
      aside={isSample ? <Tag kind="sample">Sample data</Tag> : null}
    >
      {isSample && (
        <p className="note">These numbers are placeholders. Real results replace them when the results API ships.</p>
      )}
      {run ? <RunDetails run={run} /> : <p className="note">Loading the latest run…</p>}
    </Section>
  );
}

function RunDetails({ run }: { run: RunSummary }) {
  const sum = totals(run);
  return (
    <div className="run" data-source={run.source}>
      <dl className="run__stats">
        <div className={`run__stat run__stat--outcome outcome--${run.outcome}`}>
          <dt>Outcome</dt>
          <dd>
            <svg viewBox="0 0 12 12" aria-hidden="true" className="outcome__icon">
              {run.outcome === "passed" ? <path d="M2.5 6.5l2.3 2.3L9.5 3.8" /> : <path d="M3 3l6 6M9 3l-6 6" />}
            </svg>
            {OUTCOME_LABEL[run.outcome]}
          </dd>
        </div>
        <div className="run__stat">
          <dt>Tests</dt>
          <dd>
            <span className="num">{sum.passed}</span> passed · <span className="num">{sum.failed}</span> failed ·{" "}
            <span className="num">{sum.skipped}</span> skipped
          </dd>
        </div>
        <div className="run__stat">
          <dt>Duration</dt>
          <dd className="num">{formatDuration(run.durationSeconds)}</dd>
        </div>
        <div className="run__stat">
          <dt>Branch · commit</dt>
          <dd className="mono">
            {run.branch} · {run.commit}
          </dd>
        </div>
        <div className="run__stat">
          <dt>Environment</dt>
          <dd>{run.environment}</dd>
        </div>
        <div className="run__stat">
          <dt>Started</dt>
          <dd>
            <time dateTime={run.startedAt}>{formatDate(run.startedAt)}</time>
          </dd>
        </div>
      </dl>
      <table className="run__suites">
        <caption>Results by suite</caption>
        <thead>
          <tr>
            <th scope="col">Suite</th>
            <th scope="col">Passed</th>
            <th scope="col">Failed</th>
            <th scope="col">Skipped</th>
          </tr>
        </thead>
        <tbody>
          {run.suites.map((suite) => (
            <tr key={suite.name}>
              <th scope="row">{suite.name}</th>
              <td>{suite.passed}</td>
              <td>{suite.failed}</td>
              <td>{suite.skipped}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
