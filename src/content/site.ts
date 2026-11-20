// Every piece of editable copy on the site lives in this file.
// Source for profile and experience: Aswin's resume. Do not add claims that are not in it.
// Anything marked `draft: true` is shown with a "Draft" label until Aswin reviews it.

export type Status = "live" | "in-progress" | "planned";

export interface Link {
  label: string;
  href: string;
}

export interface Role {
  title: string;
  company: string;
  dates: string;
}

export interface ExperienceEntry {
  roles: Role[];
  project: {
    name: string;
    dates: string;
    client: string;
    highlights: string[];
    stack: string[];
  };
}

export interface SkillGroup {
  label: string;
  items: string[];
}

export interface EvidenceSkill {
  name: string;
  atWork: string;
  status: Status;
  evidence?: Link;
}

export interface PipelineStage {
  id: string;
  label: string;
  detail: string;
  status: Status;
}

export interface Note {
  title: string;
  body: string;
}

export interface Decision {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
}

const REPO = "https://github.com/aswinrajmk/portfolio";
const QA_REPO = "https://github.com/aswinrajmk/qa-tests";

export const profile = {
  name: "Aswin Raj",
  title: "Lead Engineer, QA",
  summary:
    "Lead QA engineer with over eight years of testing web, mobile and API systems. I currently test wealth-management and trading software for a US fintech company.",
  facts: [
    { label: "Experience", value: "8+ years in QA" },
    { label: "Current domain", value: "Wealth management and trading" },
    { label: "Main stack", value: "Playwright + TypeScript" },
    { label: "Mobile", value: "Appium + WebdriverIO" },
  ],
  practice: [
    "Test planning, test case design and traceability across the SDLC and STLC",
    "Defect management and test summary reporting",
    "Functional, regression, release and UAT testing",
    "API and database checks with Postman and SQL",
    "Agile and Scrum teams, working closely with product owners and developers",
  ],
} as const;

export const links = {
  email: { label: "aswin.nrk@gmail.com", href: "mailto:aswin.nrk@gmail.com" },
  linkedin: { label: "linkedin.com/in/aswinrajmk", href: "https://www.linkedin.com/in/aswinrajmk" },
  github: { label: "github.com/aswinrajmk", href: "https://github.com/aswinrajmk" },
} satisfies Record<string, Link>;

export const experience: ExperienceEntry[] = [
  {
    roles: [{ title: "Lead Engineer, QA", company: "QBurst Technologies", dates: "Feb 2023 – present" }],
    project: {
      name: "Wealth management and trading platform",
      dates: "Apr 2023 – present",
      client: "A US fintech company that builds wealth-management software for financial advisors and institutions.",
      highlights: [
        "Contribute to moving UI automation from Selenium WebdriverIO to Playwright, and maintain both suites.",
        "Automate regression, smoke, sanity and API suites in Playwright, run them in GitLab CI and track results in ReportPortal.",
        "Run cross-browser and cross-platform checks on BrowserStack.",
        "Write and run test cases in Zephyr, later Xray, covering functional, regression, release and UAT testing.",
        "Use Amazon Q and Microsoft Copilot for code generation, debugging, refactoring and code review.",
      ],
      stack: ["Playwright", "WebdriverIO", "BrowserStack", "GitLab CI", "ReportPortal", "Xray", "Zephyr", "New Relic"],
    },
  },
  {
    roles: [{ title: "Test Engineer", company: "Infosys", dates: "Jul 2021 – Feb 2023" }],
    project: {
      name: "Retail eCommerce",
      dates: "Aug 2021 – Feb 2023",
      client: "A US automotive aftermarket parts retailer, on web and native platforms.",
      highlights: [
        "Automated in-sprint features and extended regression coverage with Selenium WebDriver, Java, TestNG and Cucumber.",
        "Tested APIs in Postman and checked backend data with SQL.",
        "Validated order management and payment flows across IBM Sterling OMS and Cybersource.",
        "Ran automated suites through Jenkins and cross-browser tests on BrowserStack.",
      ],
      stack: ["Selenium", "Java", "TestNG", "Cucumber", "Postman", "SQL", "Jenkins", "IBM Sterling OMS"],
    },
  },
  {
    roles: [
      { title: "Software Test Engineer", company: "Vofox Solutions", dates: "May 2019 – Jul 2021" },
      { title: "Quality Analyst", company: "DLI-IT Group", dates: "Apr 2017 – Oct 2018" },
    ],
    project: {
      name: "Enterprise apps in HR management and airlines",
      dates: "Apr 2017 – Jul 2021",
      client: "Desktop, web, PWA and iOS applications for enterprise clients.",
      highlights: [
        "Built a UI automation framework from scratch with Protractor, Jasmine and Chai, and ran it in Docker.",
        "Wrote Appium scripts for iOS apps covering key business flows.",
        "Tested across desktop, web, PWA, iPad, iOS and macOS.",
        "Added BDD automation and SQL checks, supported releases and handled on-call production issues.",
      ],
      stack: ["Protractor", "Jasmine", "Appium", "Selenium", "TestNG", "Docker", "SQL", "Redmine"],
    },
  },
];

export const toolbox: SkillGroup[] = [
  {
    label: "Automation",
    items: ["Playwright", "WebdriverIO", "Appium", "Selenium WebDriver", "TestNG", "Cucumber", "Mocha"],
  },
  { label: "Languages", items: ["TypeScript", "JavaScript", "Java", "SQL"] },
  { label: "API and monitoring", items: ["Postman", "New Relic", "Tsuga", "Amplitude"] },
  { label: "CI/CD and version control", items: ["GitLab CI/CD", "Jenkins", "Git", "Bitbucket", "Maven", "Docker"] },
  { label: "Test management", items: ["Jira", "Confluence", "Xray", "Zephyr", "Redmine"] },
  { label: "Business systems", items: ["IBM Sterling OMS", "Cybersource"] },
];

export const credentials: { label: string; detail: string }[] = [
  { label: "ISTQB Certified Tester, Foundation Level v4.0", detail: "Indian Testing Board" },
  { label: "Scrum Foundation Professional Certificate", detail: "CertiProf" },
  { label: "B.Tech, Computer Science and Engineering", detail: "University of Calicut, 2016" },
];

// QA dashboard: what this site shows publicly. "atWork" comes from the resume; "status" is about
// evidence on this site only. Never set "live" without an evidence link.
export const evidence: EvidenceSkill[] = [
  {
    name: "Playwright + TypeScript",
    atWork: "QBurst, 2023 – present",
    status: "live",
    evidence: { label: "qa-tests: suite, fixtures, self-healing, axe checks", href: QA_REPO },
  },
  {
    name: "Requirement traceability",
    atWork: "Test planning and traceability across the SDLC",
    status: "live",
    evidence: { label: "Requirements coverage matrix", href: "#requirements" },
  },
  {
    name: "API automation",
    atWork: "Playwright API suites, Postman",
    status: "in-progress",
    evidence: { label: "API tests in qa-tests", href: `${QA_REPO}/tree/main/tests/api` },
  },
  { name: "Appium + WebdriverIO", atWork: "Appium for iOS, WebdriverIO suites at QBurst", status: "planned" },
  {
    name: "CI/CD",
    atWork: "GitLab CI, Jenkins",
    status: "live",
    evidence: { label: "GitHub Actions runs", href: `${REPO}/actions` },
  },
  {
    name: "AI agents in QA",
    atWork: "Amazon Q, Microsoft Copilot",
    status: "in-progress",
    evidence: { label: "Telegram bot and test drafting from requirements", href: `${REPO}/tree/main/worker/bot` },
  },
  { name: "Test strategy", atWork: "Test planning and test case design", status: "in-progress" },
  { name: "Team leadership", atWork: "Lead Engineer, QA", status: "planned" },
];

export const pipeline: PipelineStage[] = [
  { id: "requirement", label: "Requirement", detail: "Issue or Jira story → AI tests", status: "live" },
  { id: "change", label: "App change", detail: "Push to WealthLite main", status: "live" },
  { id: "deploy", label: "Deploy", detail: "GitHub Actions to Workers", status: "live" },
  { id: "trigger", label: "Trigger", detail: "Deploy event to qa-tests", status: "live" },
  { id: "tests", label: "QA suite", detail: "Playwright, self-healing", status: "live" },
  { id: "api", label: "Results API", detail: "Worker + D1, per test", status: "live" },
  { id: "dashboard", label: "Live report", detail: "This dashboard", status: "live" },
  { id: "telegram", label: "Telegram bot", detail: "Reports, runs, code changes", status: "live" },
];

export const strategy = {
  draft: true,
  notes: [
    {
      title: "Most checks sit below the UI",
      body: "API and data checks are fast and rarely flaky, so they carry most of the coverage. UI tests cover the journeys a user would notice breaking, not every field.",
    },
    {
      title: "Risk decides depth",
      body: "In wealth management, money movement, permissions and the numbers advisors see carry the most risk. Those get the deepest coverage; low-risk screens get a smoke check.",
    },
    {
      title: "What I choose not to automate",
      body: "One-off checks, layouts that change every sprint, and flows inside third-party screens we do not control. Exploratory testing stays manual because its value is in the thinking.",
    },
    {
      title: "Flaky tests are bugs",
      body: "A flaky test gets fixed or quarantined with an owner. Retrying until green hides real failures and teaches the team to ignore red builds.",
    },
    {
      title: "Test before merge, not after",
      body: "Every pull request gets its own preview environment and test run, so failures show up while the change is still small.",
    },
  ] satisfies Note[],
};

export const decisions: { draft: boolean; items: Decision[] } = {
  draft: true,
  items: [
    {
      id: "ADR-001",
      title: "Workers with static assets over Pages",
      context: "The site needs static pages now and API routes for test results later.",
      decision: "Serve both from one Worker: static assets plus a fetch handler that owns /api.",
      consequences:
        "One config and one deploy. PR previews come from Worker Previews. Every request runs the Worker, which is fine within the free tier.",
    },
    {
      id: "ADR-002",
      title: "Playwright fixtures for test setup",
      context: "Tests need signed-in users and seeded data without copying setup code into each file.",
      decision: "Put setup and teardown in typed Playwright fixtures instead of beforeEach hooks.",
      consequences:
        "Tests read as intent, setup is reused and isolated per test. New contributors need to learn how fixtures compose.",
    },
    {
      id: "ADR-003",
      title: "Previews with isolated data",
      context: "Tests on a pull request must never touch production data.",
      decision: "Each PR gets its own Worker Preview with its own bindings; tests write only to those.",
      consequences:
        "Tests can create and delete data freely. Previews are deleted when the PR closes to stay under the free plan's 100-preview limit.",
    },
    {
      id: "ADR-004",
      title: "Local model and human approval for Jira test cases",
      context:
        "New Jira stories need an early requirement review and a small set of manual test cases, without sending story text to a paid API.",
      decision:
        "A self-hosted n8n workflow picks up new stories every minute. A local Qwen model on Ollama analyses each story and drafts test cases. Each step waits for approval in Telegram before anything is written to Jira.",
      consequences:
        "Story text stays on my machine and model calls cost nothing. Approved cases become Jira Test issues linked to the story. The small model needs clear acceptance criteria, and the flow only runs while that machine is on.",
    },
  ],
};

export const upcoming = {
  ai: {
    today:
      "At work I use Amazon Q and Microsoft Copilot for test case design, script generation, debugging and code review.",
    planned: [
      "AI-assisted healing for cases the rule-based healer cannot resolve (today it uses test ids and text similarity)",
      "A triage agent that groups failed tests and suggests likely causes",
      "Test generation with the Playwright MCP server, so drafted tests are checked against the live page as they are written",
      "A spending cap on model calls through Cloudflare AI Gateway",
    ],
  },
  leadership: {
    planned: "Notes on how I run a small QA team: reviews, onboarding, and deciding what to test.",
  },
};
