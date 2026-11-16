import { profile } from "../../content/site";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <p className="eyebrow">{profile.title}</p>
      <h1 id="hero-title">{profile.name}</h1>
      <p className="hero__summary">{profile.summary}</p>
      <dl className="facts">
        {profile.facts.map((fact) => (
          <div key={fact.label} className="facts__item">
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <a className="cta" href="/dashboard/">
        See the QA dashboard <span aria-hidden="true">→</span>
        <span className="cta__note">How I work, shown in a real pipeline</span>
      </a>
    </section>
  );
}
