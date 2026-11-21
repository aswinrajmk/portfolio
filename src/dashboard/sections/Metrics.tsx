import { useState } from "react";
import { getMetrics, runReportUrl, type MetricsResponse, type TrendPoint, type Verdict } from "../../data";
import { Section } from "../../shared/Layout";
import { formatDate } from "../../shared/runs";
import { usePolled } from "../../shared/usePolled";

const load = () => getMetrics();
const nextDelay = () => 60_000;

const VERDICT: Record<Verdict, { label: string; icon: string }> = {
  go: { label: "GO", icon: "✓" },
  caution: { label: "CAUTION", icon: "!" },
  "no-go": { label: "NO-GO", icon: "✕" },
};

const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`);
function duration(msValue: number | null): string {
  if (msValue === null) return "–";
  if (msValue < 10_000) return `${(msValue / 1000).toFixed(1)} s`;
  const s = Math.round(msValue / 1000);
  if (s < 90) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 90 ? `${m} min` : `${(m / 60).toFixed(1)} h`;
}

export function Metrics({ index }: { index: number }) {
  const data = usePolled<MetricsResponse | null>(load, nextDelay);
  return (
    <Section id="metrics" index={index} title="Quality metrics and release readiness">
      <p className="lede">
        What I watch as a QA lead before a release, computed from every stored run (last {data?.window.runs ?? 30} runs,{" "}
        {data?.window.days ?? 30} days) and from Jira. Flaky tests are bugs: they get fixed or quarantined with an
        owner, never retried until green.
      </p>
      {data === undefined ? (
        <p className="note">Loading metrics…</p>
      ) : data === null ? (
        <p className="note">The Results API could not be reached, so metrics are unavailable right now.</p>
      ) : (
        <>
          <Readiness readiness={data.readiness} />
          <Kpis data={data} />
          <Trend points={data.trend.filter((p) => p.suite !== "partial")} />
          <Lists data={data} />
        </>
      )}
    </Section>
  );
}

function Readiness({ readiness }: { readiness: MetricsResponse["readiness"] }) {
  const v = VERDICT[readiness.verdict];
  return (
    <div className={`readiness readiness--${readiness.verdict}`} data-verdict={readiness.verdict}>
      <p className="readiness__verdict">
        <span className="readiness__icon" aria-hidden="true">
          {v.icon}
        </span>
        <span>
          Release readiness: <strong>{v.label}</strong>
        </span>
      </p>
      <ul className="readiness__reasons">
        {readiness.reasons.map((r) => (
          <li key={r.text} data-level={r.level}>
            {r.href ? <a href={r.href}>{r.text}</a> : r.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Kpis({ data }: { data: MetricsResponse }) {
  const c = data.coverage;
  const tiles: { label: string; value: string; detail?: string }[] = [
    { label: "Pass rate", value: pct(data.passRate), detail: "smoke and regression runs" },
    { label: "Flaky tests", value: String(data.flaky.length), detail: "passed and failed on one commit" },
    { label: "Healed locators to fix", value: String(data.healed.length) },
    {
      label: "Automation coverage",
      value: c && c.total ? pct(c.automated / c.total) : "–",
      detail: c ? `${c.automated} of ${c.total} approved Jira tests` : "Jira unavailable",
    },
    { label: "Time to green", value: duration(data.timeToGreenMs), detail: "median, red to next green run" },
    {
      label: "Suite duration",
      value: duration(data.medianDurationMs.smoke),
      detail: `smoke · regression ${duration(data.medianDurationMs.regression)} (median)`,
    },
  ];
  return (
    <dl className="run__stats kpis">
      {tiles.map((t) => (
        <div key={t.label} className="run__stat kpi">
          <dt>{t.label}</dt>
          <dd>
            <span className="kpi__value num">{t.value}</span>
            {t.detail && <span className="kpi__detail">{t.detail}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const SERIES = [
  { suite: "smoke", label: "Smoke" },
  { suite: "regression", label: "Regression" },
] as const;

function Trend({ points }: { points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="note">The pass-rate trend appears after a few more suite runs.</p>;

  const W = 640;
  const H = 200;
  const pad = { top: 16, right: 128, bottom: 28, left: 44 };
  const x = (i: number) => pad.left + (i * (W - pad.left - pad.right)) / Math.max(points.length - 1, 1);
  const y = (rate: number) => pad.top + (1 - rate) * (H - pad.top - pad.bottom);
  const summary = SERIES.map(({ suite, label }) => {
    const list = points.filter((p) => p.suite === suite);
    const last = list.at(-1);
    return last ? `${label}: latest ${pct(last.passRate)} over ${list.length} runs` : `${label}: no runs`;
  }).join(". ");
  const active = hover === null ? null : points[hover];

  return (
    <figure className="trend">
      <figcaption className="trend__head">
        <span className="trend__title">Pass rate per run</span>
        <span className="trend__legend">
          {SERIES.map((s) => (
            <span key={s.suite} className={`trend__key trend__key--${s.suite}`}>
              {s.label}
            </span>
          ))}
        </span>
      </figcaption>
      <div
        className="trend__plot"
        tabIndex={0}
        role="region"
        aria-label="Pass rate chart (scrolls sideways on small screens)"
      >
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Pass rate per run. ${summary}.`}>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line className="trend__grid" x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} />
              <text className="trend__axis" x={pad.left - 8} y={y(t) + 4} textAnchor="end">
                {pct(t)}
              </text>
            </g>
          ))}
          <text className="trend__axis" x={pad.left} y={H - 6}>
            {formatDate(points[0]?.startedAt ?? "")}
          </text>
          <text className="trend__axis" x={W - pad.right} y={H - 6} textAnchor="end">
            {formatDate(points.at(-1)?.startedAt ?? "")}
          </text>
          {active && hover !== null && (
            <line className="trend__crosshair" x1={x(hover)} x2={x(hover)} y1={pad.top} y2={H - pad.bottom} />
          )}
          {SERIES.map(({ suite, label }) => {
            const idx = points.map((p, i) => [p, i] as const).filter(([p]) => p.suite === suite);
            if (!idx.length) return null;
            const path = idx.map(([p, i], n) => `${n ? "L" : "M"}${x(i)},${y(p.passRate)}`).join(" ");
            const [lastP, lastI] = idx[idx.length - 1] ?? [];
            return (
              <g key={suite} className={`trend__series trend__series--${suite}`}>
                <path d={path} />
                {idx.map(([p, i]) => (
                  <a
                    key={p.runId}
                    href={runReportUrl(p.runId)}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-label={`${label} run ${formatDate(p.startedAt)}: ${pct(p.passRate)}`}
                  >
                    <circle className="trend__hit" cx={x(i)} cy={y(p.passRate)} r={10} />
                    <circle className="trend__dot" cx={x(i)} cy={y(p.passRate)} r={4} />
                  </a>
                ))}
                {lastP && lastI !== undefined && (
                  <text
                    className="trend__label"
                    x={x(lastI) + 10}
                    y={y(lastP.passRate) + (suite === "smoke" ? -6 : 14)}
                  >
                    {label} {pct(lastP.passRate)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {active && hover !== null && (
          <div className="trend__tip" style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
            <strong>{active.suite === "smoke" ? "Smoke" : "Regression"}</strong> {pct(active.passRate)}
            <br />
            {formatDate(active.startedAt)} · {active.status}
          </div>
        )}
      </div>
      <details className="trend__table">
        <summary>Show the runs as a table</summary>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Runs in the trend">
          <table className="recent">
            <thead>
              <tr>
                <th scope="col">Started</th>
                <th scope="col">Suite</th>
                <th scope="col">Pass rate</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.runId}>
                  <th scope="row">
                    <a href={runReportUrl(p.runId)}>{formatDate(p.startedAt)}</a>
                  </th>
                  <td>{p.suite}</td>
                  <td className="num">{pct(p.passRate)}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function Lists({ data }: { data: MetricsResponse }) {
  return (
    <div className="metric-lists">
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Flaky tests">
        <table className="matrix">
          <caption>Flaky tests</caption>
          <thead>
            <tr>
              <th scope="col">Test</th>
              <th scope="col">Failed / passed on one commit</th>
            </tr>
          </thead>
          <tbody>
            {data.flaky.length ? (
              data.flaky.map((f) => (
                <tr key={`${f.commit}${f.file}${f.title}`}>
                  <th scope="row">{f.title}</th>
                  <td className="num">
                    {f.failures} / {f.passes} <span className="mono">{f.commit.slice(0, 7)}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="empty">
                  None in the window
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Healed locators to fix">
        <table className="matrix">
          <caption>Healed locators to fix</caption>
          <thead>
            <tr>
              <th scope="col">Test</th>
              <th scope="col">Suggested locator</th>
            </tr>
          </thead>
          <tbody>
            {data.healed.length ? (
              data.healed.map((h) => (
                <tr key={`${h.file}${h.title}`}>
                  <th scope="row">
                    <a href={runReportUrl(h.runId)}>{h.title}</a>
                  </th>
                  <td>
                    <code>{h.suggestion}</code>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="empty">
                  None: every locator matched first time
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Slowest tests">
        <table className="matrix">
          <caption>Slowest tests</caption>
          <thead>
            <tr>
              <th scope="col">Test</th>
              <th scope="col">Average</th>
            </tr>
          </thead>
          <tbody>
            {data.slowest.map((s) => (
              <tr key={`${s.file}${s.title}`}>
                <th scope="row">{s.title}</th>
                <td className="num">{duration(s.avgMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
