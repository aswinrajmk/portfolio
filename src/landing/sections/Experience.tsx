import { experience } from "../../content/site";
import { Section } from "../../shared/Layout";

export function Experience({ index }: { index: number }) {
  return (
    <Section id="experience" index={index} title="Experience">
      <ol className="timeline">
        {experience.map((entry) => (
          <li key={entry.project.name} className="timeline__entry">
            <div className="timeline__roles">
              {entry.roles.map((role) => (
                <p key={role.company} className="role">
                  <span className="role__title">{role.title}</span>
                  <span className="role__company">{role.company}</span>
                  <span className="role__dates">{role.dates}</span>
                </p>
              ))}
            </div>
            <div className="project">
              <h3>
                {entry.project.name} <span className="project__dates">{entry.project.dates}</span>
              </h3>
              <p className="project__client">{entry.project.client}</p>
              <ul className="project__highlights">
                {entry.project.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <ul className="chips" aria-label="Tools used">
                {entry.project.stack.map((tool) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
