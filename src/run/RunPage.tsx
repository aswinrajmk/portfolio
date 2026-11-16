import { getRun, screenshotUrl, type RunDetail, type TestResult } from "../data";
import { Layout } from "../shared/Layout";
import {
  Counts,
  formatDate,
  formatDuration,
  runDuration,
  RunStatusBadge,
  shortSha,
  TestStatusBadge,
} from "../shared/runs";
import { usePolled } from "../shared/usePolled";

const runId = new URLSearchParams(window.location.search).get("id");

type Loaded = { state: "found"; run: RunDetail } | { state: "missing" };

async function load(): Promise<Loaded> {
  const run = runId ? await getRun(runId) : null;
  return run ? { state: "found", run } : { state: "missing" };
}

// Poll every 2 seconds while the run is in progress, then stop.
const nextDelay = (loaded: Loaded) => (loaded.state === "found" && loaded.run.status === "running" ? 2_000 : null);

export function RunPage() {
  const loaded = usePolled(load, nextDelay);

  return (
    <Layout page="dashboard" sections={[]}>
      <p className="crumbs">
        <a href="/dashboard/">QA dashboard</a> <span aria-hidden="true">/</span> Run report
      </p>
      {!loaded && <p className="note page-intro">Loading the run…</p>}
      {loaded?.state === "missing" && (
        <header className="page-intro">
          <h1>Run not found</h1>
          <p className="lede">
            This run does not exist or the link is incomplete. See the <a href="/dashboard/">latest runs</a>.
          </p>
        </header>
      )}
      {loaded?.state === "found" && <Report run={loaded.run} />}
    </Layout>
  );
}

function Report({ run }: { run: RunDetail }) {
  const duration = runDuration(run);
  const attention = run.tests.filter((t) => t.status === "failed" || t.status === "healed").length;

  return (
    <>
      <header className="page-intro report-head">
        <p className="eyebrow">Run report · {run.project}</p>
        <h1>
          {run.trigger === "deploy" ? "After app deploy" : "Manual run"}{" "}
          <span className="report-head__status">
            <RunStatusBadge status={run.status} />
          </span>
        </h1>
        <p className="lede" aria-live="polite">
          <Counts run={run} />
          {run.status === "running" && " so far. New results appear as each test finishes."}
        </p>
      </header>

      <dl className="report-meta">
        <div>
          <dt>Started</dt>
          <dd>
            <time dateTime={run.startedAt}>{formatDate(run.startedAt)}</time>
          </dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd className="num">{duration ?? "In progress"}</dd>
        </div>
        <div>
          <dt>App commit</dt>
          <dd>
            <span className="mono">{shortSha(run.commitSha)}</span> {run.commitMessage}
          </dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>
            <a href={run.targetUrl}>{run.targetUrl.replace(/^https?:\/\//, "")}</a>
          </dd>
        </div>
        {run.ciRunUrl && (
          <div>
            <dt>CI</dt>
            <dd>
              <a href={run.ciRunUrl}>GitHub Actions run</a>
            </dd>
          </div>
        )}
      </dl>

      {run.status === "incomplete" && (
        <p className="note">This run stopped reporting before it finished, so its results are partial.</p>
      )}

      <section className="section" aria-labelledby="tests-title">
        <div className="section__head">
          <h2 id="tests-title">Tests</h2>
          {attention > 0 && <span className="section__aside note">{attention} need attention, shown open</span>}
        </div>
        {run.tests.length === 0 ? (
          <p className="note">No test has reported yet.</p>
        ) : (
          <ol className="tests">
            {run.tests.map((test) => (
              <TestRow key={test.id} test={test} />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function TestRow({ test }: { test: TestResult }) {
  const hasDetail = test.error || test.healing || test.steps.length > 0 || test.logs.length > 0 || test.hasScreenshot;
  const summary = (
    <>
      <TestStatusBadge status={test.status} />
      <span className="test__title">{test.title}</span>
      <span className="test__file mono">{test.file}</span>
      <span className="test__time num">{formatDuration(test.durationMs)}</span>
    </>
  );

  return (
    <li className={`test test--${test.status}`}>
      {hasDetail ? (
        <details open={test.status === "failed" || test.status === "healed"}>
          <summary className="test__row">{summary}</summary>
          <div className="test__detail">
            {test.healing && (
              <div className="healing">
                <h3>Self-healed locator</h3>
                <p>
                  <strong>{test.healing.element}</strong> was not found by <code>{test.healing.broken}</code>. The test
                  found it by <code>{test.healing.used}</code> and carried on.
                </p>
                <p>
                  Suggested fix: <code>{test.healing.suggestion}</code>
                </p>
              </div>
            )}
            {test.error && (
              <div className="failure">
                <h3>Error</h3>
                <pre>{test.error.message}</pre>
                {test.error.stack && (
                  <details>
                    <summary>Stack trace</summary>
                    <pre>{test.error.stack}</pre>
                  </details>
                )}
              </div>
            )}
            {test.hasScreenshot && (
              <figure className="shot">
                <img
                  src={screenshotUrl(test.id)}
                  alt={`Screenshot of the page when "${test.title}" failed`}
                  loading="lazy"
                  width="1280"
                  height="720"
                />
                <figcaption>Screenshot at the point of failure</figcaption>
              </figure>
            )}
            {test.steps.length > 0 && (
              <div>
                <h3>Steps</h3>
                <ol className="steps">
                  {test.steps.map((step, i) => (
                    <li key={i} className={step.failed ? "steps__failed" : undefined}>
                      <span>{step.title}</span>
                      <span className="num">{formatDuration(step.durationMs)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {test.logs.length > 0 && (
              <div>
                <h3>Logs</h3>
                <pre className="logs">{test.logs.join("\n")}</pre>
              </div>
            )}
          </div>
        </details>
      ) : (
        <div className="test__row">{summary}</div>
      )}
    </li>
  );
}
