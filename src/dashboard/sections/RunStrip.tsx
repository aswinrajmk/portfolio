import { getLatestRun, getRecentRuns, runReportUrl, type RunSummary, type Sourced } from "../../data";
import { Section } from "../../shared/Layout";
import { Counts, formatDate, runDuration, RunStatusBadge, shortSha } from "../../shared/runs";
import { Tag } from "../../shared/StatusBadge";
import { usePolled } from "../../shared/usePolled";

interface Snapshot {
  latest: Sourced<RunSummary>;
  recent: RunSummary[];
}

async function load(): Promise<Snapshot> {
  const [latest, recent] = await Promise.all([getLatestRun(), getRecentRuns(8)]);
  return { latest, recent };
}

// While a run is in progress the strip refreshes every 3 seconds; otherwise every 30.
const nextDelay = (s: Snapshot) => (s.latest.data.status === "running" ? 3_000 : 30_000);

/** compact: the Overview tab shows the latest run only, without the recent-runs table. */
export function RunStrip({ index, compact = false }: { index: number; compact?: boolean }) {
  const snapshot = usePolled(load, nextDelay);
  const isSample = snapshot?.latest.source === "sample";

  return (
    <Section
      id="latest-run"
      index={index}
      title="Latest pipeline run"
      aside={isSample ? <Tag kind="sample">Sample data</Tag> : null}
    >
      <p className="note">
        {isSample
          ? "No real runs are stored yet, so these numbers are placeholders."
          : "Tests run against wealthlite, a small demo app with synthetic data, every time it deploys."}
      </p>
      {snapshot ? (
        <>
          <RunDetails run={snapshot.latest.data} source={snapshot.latest.source} />
          {!compact && !isSample && snapshot.recent.length > 1 && <RecentRuns runs={snapshot.recent} />}
        </>
      ) : (
        <p className="note">Loading the latest run…</p>
      )}
    </Section>
  );
}

function RunDetails({ run, source }: { run: RunSummary; source: Sourced<RunSummary>["source"] }) {
  const duration = runDuration(run);
  return (
    <div className="run" data-source={source}>
      <dl className="run__stats">
        <div className="run__stat run__stat--outcome">
          <dt>Status</dt>
          <dd>
            <RunStatusBadge status={run.status} />
          </dd>
        </div>
        <div className="run__stat">
          <dt>Tests</dt>
          <dd>
            <Counts run={run} />
          </dd>
        </div>
        <div className="run__stat">
          <dt>Duration</dt>
          <dd className="num">{duration ?? "In progress"}</dd>
        </div>
        <div className="run__stat">
          <dt>Trigger</dt>
          <dd>{run.trigger === "deploy" ? "App deploy" : "Manual"}</dd>
        </div>
        <div className="run__stat">
          <dt>Commit</dt>
          <dd>
            <span className="mono">{shortSha(run.commitSha)}</span>
            {run.commitMessage && <span className="run__commit-msg"> {run.commitMessage}</span>}
          </dd>
        </div>
        <div className="run__stat">
          <dt>Started</dt>
          <dd>
            <time dateTime={run.startedAt}>{formatDate(run.startedAt)}</time>
          </dd>
        </div>
      </dl>
      {source === "live" && (
        <p className="run__actions">
          <a href={runReportUrl(run.id)}>
            Open the full run report <span aria-hidden="true">→</span>
          </a>
          {run.ciRunUrl && <a href={run.ciRunUrl}>CI run on GitHub</a>}
        </p>
      )}
    </div>
  );
}

function RecentRuns({ runs }: { runs: RunSummary[] }) {
  return (
    <div className="table-wrap">
      <table className="recent">
        <caption>Recent runs</caption>
        <thead>
          <tr>
            <th scope="col">Started</th>
            <th scope="col">Status</th>
            <th scope="col">Tests</th>
            <th scope="col">Commit</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <th scope="row">
                <a href={runReportUrl(run.id)}>
                  <time dateTime={run.startedAt}>{formatDate(run.startedAt)}</time>
                </a>
              </th>
              <td>
                <RunStatusBadge status={run.status} />
              </td>
              <td>
                <Counts run={run} />
              </td>
              <td>
                <span className="mono">{shortSha(run.commitSha)}</span>{" "}
                <span className="recent__msg">{run.commitMessage}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
