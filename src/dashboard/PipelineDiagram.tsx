import { useId } from "react";
import { pipeline, type Status } from "../content/site";

const NODE_W = 200;
const NODE_H = 76;
const GAP_X = 52;
const GAP_Y = 48;
const PAD = 8;

const STATUS_TEXT: Record<Status, string> = {
  live: "LIVE",
  "in-progress": "IN PROGRESS",
  planned: "PLANNED",
};

interface Placed {
  x: number;
  y: number;
}

// Lays stages out left-to-right, snaking back on alternate rows so the flow never jumps.
function place(index: number, columns: number): Placed {
  const row = Math.floor(index / columns);
  const offset = index % columns;
  const col = row % 2 === 0 ? offset : columns - 1 - offset;
  return { x: PAD + col * (NODE_W + GAP_X), y: PAD + row * (NODE_H + GAP_Y) };
}

function connector(from: Placed, to: Placed) {
  if (from.y === to.y) {
    const y = from.y + NODE_H / 2;
    return from.x < to.x ? `M${from.x + NODE_W} ${y} H${to.x - 6}` : `M${from.x} ${y} H${to.x + NODE_W + 6}`;
  }
  const x = from.x + NODE_W / 2;
  return `M${x} ${from.y + NODE_H} V${to.y - 6}`;
}

export function PipelineDiagram({ columns, className }: { columns: number; className: string }) {
  const id = `pipeline${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const rows = Math.ceil(pipeline.length / columns);
  const width = PAD * 2 + columns * NODE_W + (columns - 1) * GAP_X;
  const height = PAD * 2 + rows * NODE_H + (rows - 1) * GAP_Y;
  const positions = pipeline.map((_, i) => place(i, columns));
  const description = pipeline.map((s) => `${s.label}: ${STATUS_TEXT[s.status].toLowerCase()}`).join(", ");

  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>Pipeline from pull request to dashboard and Telegram</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <defs>
        <marker id={`${id}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" className="diagram__arrowhead" />
        </marker>
      </defs>
      {pipeline.slice(1).map((stage, i) => {
        const from = positions[i];
        const to = positions[i + 1];
        if (!from || !to) return null;
        return (
          <path
            key={`edge-${stage.id}`}
            d={connector(from, to)}
            className={`diagram__edge diagram__edge--${stage.status}`}
            markerEnd={`url(#${id}-arrow)`}
          />
        );
      })}
      {pipeline.map((stage, i) => {
        const pos = positions[i];
        if (!pos) return null;
        return (
          <g
            key={stage.id}
            className={`diagram__node diagram__node--${stage.status}`}
            transform={`translate(${pos.x} ${pos.y})`}
          >
            <rect width={NODE_W} height={NODE_H} rx="6" />
            <text x="14" y="24" className="diagram__status">
              {STATUS_TEXT[stage.status]}
            </text>
            <text x="14" y="46" className="diagram__label">
              {stage.label}
            </text>
            <text x="14" y="64" className="diagram__detail">
              {stage.detail}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
