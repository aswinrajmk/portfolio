import type { Status } from "../content/site";

const LABELS: Record<Status, string> = {
  live: "Live",
  "in-progress": "In progress",
  planned: "Planned",
};

// Status is carried by text and shape, never colour alone.
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status status--${status}`} data-status={status}>
      <svg className="status__icon" viewBox="0 0 12 12" aria-hidden="true">
        {status === "live" && <circle cx="6" cy="6" r="4.5" />}
        {status === "in-progress" && (
          <>
            <circle cx="6" cy="6" r="4" className="status__ring" />
            <path d="M6 2a4 4 0 0 1 0 8z" />
          </>
        )}
        {status === "planned" && <circle cx="6" cy="6" r="4" className="status__ring" />}
      </svg>
      {LABELS[status]}
    </span>
  );
}

export function Tag({ kind, children }: { kind: "sample" | "draft"; children: string }) {
  return (
    <span className={`tag tag--${kind}`} data-tag={kind}>
      {children}
    </span>
  );
}
