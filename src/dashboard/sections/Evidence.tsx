import { evidence } from "../../content/site";
import { Section } from "../../shared/Layout";
import { StatusBadge } from "../../shared/StatusBadge";

export function Evidence({ index }: { index: number }) {
  return (
    <Section id="evidence" index={index} title="Skills and evidence">
      <p className="lede">
        “At work” is where I use the skill day to day. “On this site” tracks what you can check here yourself.
      </p>
      <div className="table-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">At work</th>
              <th scope="col">On this site</th>
              <th scope="col">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((skill) => (
              <tr key={skill.name}>
                <th scope="row">{skill.name}</th>
                <td>{skill.atWork}</td>
                <td>
                  <StatusBadge status={skill.status} />
                </td>
                <td>
                  {skill.evidence ? (
                    <a href={skill.evidence.href}>{skill.evidence.label}</a>
                  ) : (
                    <span className="empty">No evidence linked yet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
