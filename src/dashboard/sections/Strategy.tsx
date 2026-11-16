import { strategy } from "../../content/site";
import { Section } from "../../shared/Layout";
import { Tag } from "../../shared/StatusBadge";

export function Strategy({ index }: { index: number }) {
  return (
    <Section
      id="strategy"
      index={index}
      title="Test strategy"
      aside={strategy.draft ? <Tag kind="draft">Draft</Tag> : null}
    >
      <ol className="notes">
        {strategy.notes.map((note) => (
          <li key={note.title}>
            <h3>{note.title}</h3>
            <p>{note.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
