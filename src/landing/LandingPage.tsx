import { Layout, type SectionRef } from "../shared/Layout";
import { Contact } from "./sections/Contact";
import { Credentials } from "./sections/Credentials";
import { Experience } from "./sections/Experience";
import { Hero } from "./sections/Hero";
import { Skills } from "./sections/Skills";

const SECTIONS: SectionRef[] = [
  { id: "experience", title: "Experience" },
  { id: "skills", title: "Skills" },
  { id: "credentials", title: "Credentials" },
  { id: "contact", title: "Contact" },
];

export function LandingPage() {
  return (
    <Layout page="profile" sections={SECTIONS}>
      <Hero />
      <Experience index={1} />
      <Skills index={2} />
      <Credentials index={3} />
      <Contact index={4} />
    </Layout>
  );
}
