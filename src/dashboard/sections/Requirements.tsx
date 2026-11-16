import { getRequirements, runReportUrl, type RequirementsResponse } from "../../data";
import { Section } from "../../shared/Layout";
import { RequirementStateBadge, TestStatusBadge } from "../../shared/runs";
import { usePolled } from "../../shared/usePolled";

const load = () => getRequirements();
const nextDelay = () => 30_000;

export function Requirements({ index }: { index: number }) {
  const data = usePolled<RequirementsResponse | null>(load, nextDelay);

  return (
    <Section id="requirements" index={index} title="Requirements coverage">
      <p className="lede">
        Each requirement is a GitHub issue in wealthlite. When I open or edit one, Claude Code drafts Playwright tests
        for its acceptance criteria in a qa-tests pull request, tagged with the issue number. Once merged, every run
        updates this matrix: requirement, linked tests, latest result.
      </p>
      {data === undefined ? (
        <p className="note">Loading requirements…</p>
      ) : data === null ? (
        <p className="note">The Results API could not be reached, so requirement coverage is unavailable right now.</p>
      ) : data.requirements.length === 0 ? (
        <p className="note">No requirements recorded yet.</p>
      ) : (
        <>
          {!data.issuesLoaded && (
            <p className="note">GitHub could not be reached, so some requirement titles may be missing.</p>
          )}
          <div className="table-wrap">
            <table className="matrix reqs">
              <thead>
                <tr>
                  <th scope="col">Requirement</th>
                  <th scope="col">Status</th>
                  <th scope="col">Linked tests (latest result)</th>
                </tr>
              </thead>
              <tbody>
                {data.requirements.map((req) => (
                  <tr key={req.number} data-requirement={req.number}>
                    <th scope="row">
                      {req.url ? <a href={req.url}>#{req.number}</a> : <span>#{req.number}</span>}{" "}
                      {req.title || <span className="empty">Issue not found</span>}
                      {req.issueState === "closed" && <span className="reqs__closed"> (closed)</span>}
                    </th>
                    <td>
                      <RequirementStateBadge state={req.state} />
                    </td>
                    <td>
                      {req.tests.length === 0 ? (
                        <span className="empty">No tagged tests have run yet</span>
                      ) : (
                        <ul className="reqs__tests">
                          {req.tests.map((t) => (
                            <li key={`${t.file}::${t.title}`}>
                              <TestStatusBadge status={t.status} /> <a href={runReportUrl(t.runId)}>{t.title}</a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}
