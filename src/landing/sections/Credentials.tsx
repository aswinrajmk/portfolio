import { credentials } from "../../content/site";
import { Section } from "../../shared/Layout";

export function Credentials({ index }: { index: number }) {
  return (
    <Section id="credentials" index={index} title="Credentials">
      <ul className="ledger">
        {credentials.map((item) => (
          <li key={item.label}>
            <span className="ledger__label">{item.label}</span>
            <span className="ledger__detail">{item.detail}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
