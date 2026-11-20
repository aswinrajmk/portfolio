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
const APP_REPO = "https://github.com/aswinrajmk/wealthlite";

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

// Jira story → reviewed test cases, run by a self-hosted n8n workflow and a local model.
// The example is copied from a real run on 2026-11-20 (story KAN-6). The Jira site is private, so nothing links to it.
export const jiraAgent = {
  source: { label: "Workflow and build script in wealthlite", href: `${APP_REPO}/tree/main/automation/n8n` },
  stages: [
    { id: "story", label: "Jira story", detail: "New story in Jira Cloud", status: "live" },
    { id: "poll", label: "n8n trigger", detail: "JQL search every minute", status: "live" },
    { id: "analyse", label: "AI analysis", detail: "Ollama + Qwen, on my Mac", status: "live" },
    { id: "approve-1", label: "Approval 1", detail: "Approve or reject in Telegram", status: "live" },
    { id: "comment", label: "Jira comment", detail: "Approved analysis on story", status: "live" },
    { id: "draft", label: "AI test cases", detail: "Minimal set, core coverage", status: "live" },
    { id: "approve-2", label: "Approval 2", detail: "Approve or reject in Telegram", status: "live" },
    { id: "create", label: "Jira Test issues", detail: "Created and linked to story", status: "live" },
  ] satisfies PipelineStage[],
  steps: [
    {
      title: "A story lands in Jira",
      body: "I write a story in Jira Cloud: a user story plus Given/When/Then acceptance criteria. Every minute, an n8n Schedule Trigger runs a JQL search through the Jira REST API. When it finds a new story, it adds an ai-new label first, so no story is ever processed twice.",
    },
    {
      title: "A local AI agent reviews the requirement",
      body: "n8n sends the story to Qwen 3.5 (2B), running locally on Ollama. A JSON schema forces structured output: a one-line summary, ambiguities and risks. The story never leaves my machine and there is no per-call API cost.",
    },
    {
      title: "I approve the analysis (human in the loop)",
      body: "The analysis arrives in Telegram with Approve and Reject buttons. An n8n Wait node pauses the run, for up to 24 hours, until I decide. If I approve, the analysis is posted to the story as a Jira comment. If I reject, the story gets an ai-rejected label so it can be reworked.",
    },
    {
      title: "The agent designs the minimal test set",
      body: "The agent drafts the smallest set of cases that covers the core behaviour: one positive case per acceptance criterion, plus at most two negative or edge cases. That is 3–6 cases, each with the criterion it covers, preconditions, steps and one expected result.",
    },
    {
      title: "I approve the test cases",
      body: "The numbered list comes back to Telegram for a second review. Nothing is written to Jira until I approve. Each button is tied to its step, so an old Approve button cannot approve the wrong stage.",
    },
    {
      title: "Test issues are created and traced",
      body: "n8n creates one Jira Test issue per case through the REST API, with the description in Atlassian Document Format. It links each one to the story as 'is tested by' and labels it ai-generated plus its case type. It then marks the story ai-done and sends me the links.",
    },
  ],
  tools: [
    {
      name: "n8n (self-hosted)",
      detail: "Workflow orchestration: Schedule Trigger, HTTP Request, Code (JavaScript), Wait, IF and Telegram nodes.",
    },
    {
      name: "Ollama + Qwen 3.5",
      detail:
        "Local LLM inference. Structured JSON output, and prompts written for requirement review and test design.",
    },
    {
      name: "Jira Cloud REST API",
      detail: "JQL search, issue creation, issue links, comments, Atlassian Document Format, a custom Test work type.",
    },
    { name: "Telegram Bot API", detail: "Approval prompts with inline buttons that resume the paused workflow." },
    {
      name: "Workflow as code",
      detail: "A Python script builds the workflow, deploys it through the n8n REST API and keeps the JSON in Git.",
    },
    {
      name: "Test design",
      detail: "Requirement review, acceptance criteria mapped to test cases, minimal risk-based coverage.",
    },
  ],
  example: {
    story: "Sign out from the portfolio page",
    criteria: [
      'Given I am signed in, when I click "Sign out", then I return to the login page',
      "Given I have signed out, when I open /portfolio directly, then I am sent to the login page",
      "Given I have signed out, when I press the browser back button, then holdings are not shown",
    ],
    flagged:
      "'Nobody else can see my holdings on a shared computer' is vague: it could mean clearing the cache, clearing cookies or deleting browser data.",
    cases: [
      "Sign out redirects to login (positive, criterion 1)",
      "Direct navigation after sign out redirects to login (positive, criterion 2)",
      "Back button hides holdings (positive, criterion 3)",
    ],
    review:
      "Looking back at this run, two of the drafted preconditions contradict themselves ('has signed out and is logged in'). The 2B model is fast and free, but its output needs a human check. That is why every step waits for approval, and why a revise step is next on the list.",
  },
};

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
