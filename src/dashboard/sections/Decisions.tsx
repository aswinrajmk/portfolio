import { decisions } from "../../content/site";
import { Section } from "../../shared/Layout";
import { Tag } from "../../shared/StatusBadge";

export function Decisions({ index }: { index: number }) {
  return (
    <Section id="decisions" index={index} title="Decisions">
      <p className="lede">Short architecture decision records for this project.</p>
      <div className="adrs">
        {decisions.items.map((adr) => (
          <article key={adr.id} className="adr" aria-labelledby={`${adr.id}-title`}>
            <header className="adr__head">
              <span className="adr__id">{adr.id}</span>
              {decisions.draft && <Tag kind="draft">Draft</Tag>}
            </header>
            <h3 id={`${adr.id}-title`}>{adr.title}</h3>
            <dl>
              <dt>Context</dt>
              <dd>{adr.context}</dd>
              <dt>Decision</dt>
              <dd>{adr.decision}</dd>
              <dt>Consequences</dt>
              <dd>{adr.consequences}</dd>
            </dl>
          </article>
        ))}
      </div>
    </Section>
  );
}
