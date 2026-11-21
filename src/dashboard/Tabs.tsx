import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { SectionRef } from "../shared/Layout";

export interface TabDef {
  id: string;
  label: string;
  sections: SectionRef[];
}

/** The tab a hash points at: a tab id ("#quality"), or the tab holding a section ("#metrics", from older links). */
export function tabForHash(tabs: TabDef[], hash: string): { tab: string; section: string | null } {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (tabs.some((t) => t.id === id)) return { tab: id, section: null };
  const owner = tabs.find((t) => t.sections.some((s) => s.id === id));
  return owner ? { tab: owner.id, section: id } : { tab: tabs[0]?.id ?? "", section: null };
}

/**
 * Active tab from the URL hash, kept in sync on hashchange (back/forward and links). When the hash names a
 * section, the section's tab opens and the page scrolls to it once it has rendered.
 */
export function useHashTab(tabs: TabDef[]): string {
  const [state, setState] = useState(() => tabForHash(tabs, window.location.hash));
  useEffect(() => {
    const onHash = () => setState(tabForHash(tabs, window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [tabs]);
  useEffect(() => {
    if (!state.section) return;
    // Wait for the panel to render (and for polled sections to lay out) before scrolling.
    const timer = window.setTimeout(() => document.getElementById(state.section ?? "")?.scrollIntoView(), 50);
    return () => window.clearTimeout(timer);
  }, [state]);
  return state.tab;
}

/** WAI-ARIA tabs: arrow keys, Home and End move between tabs; the selected tab is the only one in the tab order. */
export function TabBar({ tabs, active }: { tabs: TabDef[]; active: string }) {
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  const go = (index: number) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    if (!tab) return;
    window.location.assign(`#${tab.id}`);
    refs.current[(index + tabs.length) % tabs.length]?.focus();
  };
  const onKey = (event: KeyboardEvent, index: number) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    go(next);
  };
  return (
    <div className="tabs" role="tablist" aria-label="Dashboard views">
      {tabs.map((tab, i) => (
        <a
          key={tab.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          id={`tab-${tab.id}`}
          className="tabs__tab"
          role="tab"
          href={`#${tab.id}`}
          aria-selected={tab.id === active}
          aria-controls={`panel-${tab.id}`}
          tabIndex={tab.id === active ? 0 : -1}
          onKeyDown={(e) => onKey(e, i)}
        >
          {tab.label}
        </a>
      ))}
    </div>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="tabs__panel" role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}
