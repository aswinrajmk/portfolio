import { Layout } from "../shared/Layout";
import { mount } from "../shared/boot";

function NotFoundPage() {
  return (
    <Layout page={null} sections={[]}>
      <header className="page-intro">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p className="lede">
          There is nothing at this address. Try the <a href="/">profile</a> or the{" "}
          <a href="/dashboard/">QA dashboard</a>.
        </p>
      </header>
    </Layout>
  );
}

mount(NotFoundPage);
