import type { ReactNode } from "react";
import { links, profile } from "../content/site";
import { ThemeToggle } from "./ThemeToggle";

export interface SectionRef {
  id: string;
  title: string;
}

type Page = "profile" | "dashboard";

const NAV: { page: Page; label: string; href: string }[] = [
  { page: "profile", label: "Profile", href: "/" },
  { page: "dashboard", label: "QA dashboard", href: "/dashboard/" },
];

export function Layout({
  page,
  sections,
  children,
}: {
  page: Page | null;
  sections: SectionRef[];
  children: ReactNode;
}) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a className="site-header__brand" href="/">
          <span className="site-header__name">{profile.name}</span>
          <span className="site-header__role">{profile.title}</span>
        </a>
        <nav className="site-header__nav" aria-label="Site">
          {NAV.map((item) => (
            <a key={item.page} href={item.href} aria-current={item.page === page ? "page" : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
        <ThemeToggle />
      </header>
      <div className={`shell shell--${page ?? "plain"}`}>
        {sections.length > 0 && (
          <nav className="toc" aria-label="On this page">
            <p className="toc__label">On this page</p>
            <ol>
              {sections.map((section, i) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>
                    <span className="toc__index">{String(i + 1).padStart(2, "0")}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <footer className="site-footer">
        <p>
          Hosted on Cloudflare Workers. Tested with Playwright on every pull request.{" "}
          <a href={links.repo.href}>{links.repo.label}</a>
        </p>
      </footer>
    </>
  );
}

export function Section({
  id,
  index,
  title,
  aside,
  children,
}: {
  id: string;
  index: number;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section" id={id} aria-labelledby={`${id}-title`}>
      <div className="section__head">
        <span className="section__index" aria-hidden="true">
          {String(index).padStart(2, "0")}
        </span>
        <h2 id={`${id}-title`}>{title}</h2>
        {aside && <div className="section__aside">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
