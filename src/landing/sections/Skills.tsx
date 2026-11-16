import { profile, toolbox } from "../../content/site";
import { Section } from "../../shared/Layout";

export function Skills({ index }: { index: number }) {
  return (
    <Section id="skills" index={index} title="Skills">
      <div className="skills">
        <dl className="toolbox">
          {toolbox.map((group) => (
            <div key={group.label} className="toolbox__row">
              <dt>{group.label}</dt>
              <dd>{group.items.join(" · ")}</dd>
            </div>
          ))}
        </dl>
        <div className="practice">
          <h3>QA practice</h3>
          <ul>
            {profile.practice.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
