import { links } from "../../content/site";
import { Section } from "../../shared/Layout";

const ROWS = [
  { label: "Email", link: links.email },
  { label: "LinkedIn", link: links.linkedin },
  { label: "GitHub", link: links.github },
  { label: "Product I own", link: links.product },
];

export function Contact({ index }: { index: number }) {
  return (
    <Section id="contact" index={index} title="Contact">
      <ul className="ledger">
        {ROWS.map((row) => (
          <li key={row.label}>
            <span className="ledger__label">{row.label}</span>
            <a className="ledger__detail" href={row.link.href}>
              {row.link.label}
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}
