import { Section } from "../../shared/Layout";
import { PipelineDiagram } from "../PipelineDiagram";

export function Pipeline({ index }: { index: number }) {
  return (
    <Section id="pipeline" index={index} title="Pipeline architecture">
      <p className="lede">
        The path a change takes from pull request to results. Solid boxes run today; dashed boxes are in progress or
        planned.
      </p>
      <PipelineDiagram className="diagram diagram--wide" columns={4} />
      <PipelineDiagram className="diagram diagram--narrow" columns={1} />
    </Section>
  );
}
