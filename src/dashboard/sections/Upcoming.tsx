import { upcoming } from "../../content/site";
import { Section } from "../../shared/Layout";
import { StatusBadge } from "../../shared/StatusBadge";

export function Upcoming({ index }: { index: number }) {
  return (
    <Section id="upcoming" index={index} title="AI agents and leadership">
      <div className="upcoming">
        <article className="upcoming__item" aria-labelledby="ai-title">
          <header>
            <h3 id="ai-title">AI agents in QA</h3>
            <StatusBadge status="planned" />
          </header>
          <p>{upcoming.ai.today}</p>
          <p>Planned for this site:</p>
          <ul>
            {upcoming.ai.planned.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="upcoming__item" aria-labelledby="leadership-title">
          <header>
            <h3 id="leadership-title">Leadership</h3>
            <StatusBadge status="planned" />
          </header>
          <p>{upcoming.leadership.planned}</p>
        </article>
      </div>
    </Section>
  );
}
