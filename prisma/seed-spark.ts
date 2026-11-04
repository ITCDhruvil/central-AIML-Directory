// Registers the SPARK (SPACE Assistant) project with its starting Environments data, taken from the project brief.
// Starting data only: after this, everything is edited in the UI. No test users or passwords are created here.
// Idempotent: an existing SPARK project is kept as it is, and environments are only added when it has none.
// Run: npm run db:seed-spark   (after the add_project_environments migration has been applied)
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const NAME = "SPARK (SPACE Assistant)";
const TBC = "To be confirmed";

const DESCRIPTION = [
  "SPARK is the AI chat assistant inside SPACE, our construction and project management platform.",
  "A SPACE user asks a question in plain words (for example “How many overdue tasks do I have?”).",
  "SPARK picks the right SPACE tool, calls SPACE's own API with the user's own login, and writes a short answer from the returned data.",
  "Every user sees only what their own access allows. Version 1 is read-only: it answers, it never creates or changes data.",
  `Source code: GitHub repo Shapoorji-Pallonji/SPACE, folders chatbot/ (backend) and frontend/packages/chatbot-frontend/ (chat widget). Not connected to this platform. Owner / team: ${TBC}.`,
].join(" ");

const DOCS = [
  {
    title: "What SPARK does",
    category: "PRD",
    content: `# What SPARK does

**Type:** Enterprise AI chatbot (read-only assistant embedded in a web platform).
**Parent system:** SPACE: tasks, incidents, observations, checklists / work permits, documents (DMS), people, projects and bids, labour (LMS), HSE and Quality, contracts (CMS), admin.
**Status:** Version 1 complete on QA and UAT (28 Oct 2026). Production not yet deployed. Version 2 planned.

The goal is consistent answers (about 8 to 9 of 10 fully good), not 100% accuracy.

## Main capabilities in V1

One assistant with about 40 tools in 12 areas:

- Tasks, actions, meetings
- Incidents
- Observations, checklists / work permits (CHK/WP)
- DMS (documents): search by title, file name, keywords, document number; who uploaded; versions; sharing (no search inside document text)
- People / User Management: team, birthdays, job anniversaries
- Projects and bids
- Labour (LMS)
- HSE and Quality
- Contracts (CMS)
- Notifications (unread count, latest, filters)
- Admin (for example holidays)
- How-to guides (step-by-step, written from real SPACE screens, answered word for word with no AI call)

Extras: tables on request (first 10 rows plus the SPACE path to the full list), next-question buttons under each answer, a “Please check this value in SPACE:” note when an answer cannot be fully verified, and an Admin console (access audit, feedback inbox, settings, read-only Config tab).

## How an answer is made

1. The user asks a question in the chat panel inside SPACE.
2. The AI picks the SPACE tool that fits and calls SPACE's API with the user's login token.
3. SPACE fields come back unchanged; the AI writes a short answer.
4. Every number in the answer is checked against the data; a mismatch means a rewrite or a safe fallback.
5. The reply is tidied (dates, money, tables) and next-question buttons are added.

## Quality and test evidence

- About 2,570 automated backend tests pass.
- QA: 36 module questions checked (admin and non-admin); 23 suggested buttons clicked, all answered.
- UAT: 25 questions including 10 DMS questions, all DMS answers correct.
- Speed: QA typically 4 to 9 s per answer; UAT 9 to 18 s (first question after quiet time can take 20 to 50 s; UAT data is much bigger).
`,
  },
  {
    title: "Architecture and tech stack",
    category: "ARCHITECTURE",
    content: `# Architecture and tech stack

- **Backend:** Python 3.11, FastAPI, Uvicorn. Agent built with Microsoft Agent Framework (agent-framework-core). Folders: app/api (chat, admin, memory, feedback), app/services (routers per module, answer checks, identity), app/agent_tools (one file per module), app/data (how-to guides, access matrix).
- **AI:** Azure OpenAI, chat deployment gpt-4.1, embeddings text-embedding-3-large.
- **Data access:** SPACE gateway APIs with the user's token (main path); SQL Server (via ODBC, sqlglot guard, per-table fence) for some reads; Azure AI Search for documents.
- **Frontend:** React chat widget, npm package @itcube/space-chat, embedded in the SPACE shell. The shell's runtime-config.js tells it the chatbot API URL.
- **Security design:** own-access only (user's token), no personal data in answers (no phone, e-mail, address, employee code, birth year), read-only, no raw errors shown, honest “check in SPACE” when unsure, rate and token limits.
- **Hosting (Azure):** QA = Azure Container App space-assistant (resource group rg-chatbot-poc, registry acritcubechatbotpoc, image space-assistant-api:<tag>). UAT = Azure Web App space3-uat-chatbot, deployed by GitHub workflow .github/workflows/uat-chatbot.yml from UAT_Branch. Production Web App name planned: space3-prod-chatbot (not deployed).
- **Telemetry:** Azure Monitor / OpenTelemetry; each answer logs timing and token use.
`,
  },
  {
    title: "Known limits and Version 2 plan",
    category: "PLAN",
    content: `# Known limits and Version 2 plan

## Known limits (V1)

- Two SPACE sources can show slightly different counts.
- No labour trade-wise summary.
- No search inside document text.
- Wording can vary between two asks (numbers stay the same).
- Saved long-term memory is stored but not read yet.
- About 20 how-to guides are still to write.
- Some modules are not integrated yet (Quality dashboard numbers, Project 360, Application Links, Global Search, some HSE and LMS extras).

## Version 2 plan

- **A. ChatGPT-like memory:** read saved preferences, “remember / forget” in chat, Memory panel, Temporary chat; never remember numbers or personal data.
- **B. Faster DMS search:** an index, skip keyword search for clear file names, later content search.
- **C. Clickable redirection** from each answer to the exact SPACE screen.
- **D. Speed and capacity:** turn on the tool picker (cuts tokens per answer from about 54,000 to about 18,000); request limiter for the AI quota.
- **E. Accuracy and consistency:** measure the same 30 questions 3 times on UAT, decide which source wins when two disagree, AI-written suggestions.
- **F. Mobile app** via the gateway route /chatbot, and production deployment.

## Still to be confirmed

- Owner / team
- QA Container App URL
- Jira / board link, Azure Portal resource-group link, documentation links (PRD, architecture, deployment guide, UAT runbook, BRD v2.0)
`,
  },
] as const;

type SeedEnv = {
  name: string;
  isProduction: boolean;
  status: string;
  appUrl: string | null;
  apiUrl: string | null;
  healthUrl: string | null;
  hosting: string;
  databaseSet: string | null;
  notes: string;
  links: { label: string; url: string; group: string }[];
};

const ENVIRONMENTS: SeedEnv[] = [
  {
    name: "DEV",
    isProduction: false,
    status: "UNKNOWN",
    appUrl: "http://127.0.0.1:8012",
    apiUrl: null,
    healthUrl: null,
    hosting: "Local machine",
    databaseSet: null,
    notes: "Local backend on :8012; SPACE shell local on :4200. Local only; runtime-config.js is never committed.",
    links: [],
  },
  {
    name: "QA",
    isProduction: false,
    status: "LIVE",
    appUrl: null,
    apiUrl: null,
    healthUrl: null,
    hosting: "Azure Container App space-assistant (resource group rg-chatbot-poc, registry acritcubechatbotpoc, image space-assistant-api:<tag>)",
    databaseSet: "TEST_* databases (TEST_V1_SPACE_*)",
    notes: `Image-only deploys. Container App URL: ${TBC}.`,
    links: [],
  },
  {
    name: "UAT",
    isProduction: false,
    status: "LIVE",
    appUrl: "https://space3-uat-chatbot.azurewebsites.net",
    apiUrl: "https://space3-uat-api-gateway-api.azurewebsites.net",
    healthUrl: "https://space3-uat-api-gateway-api.azurewebsites.net/health",
    hosting: "Azure Web App space3-uat-chatbot (GitHub workflow .github/workflows/uat-chatbot.yml from UAT_Branch)",
    databaseSet: "M1_* databases",
    notes: "Slower, bigger data. The health check is the SPACE gateway's /health.",
    links: [
      { label: "SPACE web", url: "https://spaceuat.shapoorji.com", group: "App" },
      { label: "SPACE web app (Azure)", url: "https://space3-uat-web.azurewebsites.net", group: "App" },
    ],
  },
  {
    name: "PROD",
    isProduction: true,
    status: "PLANNED",
    appUrl: "https://space3-prod-chatbot.azurewebsites.net",
    apiUrl: "https://spacegateway.shapoorji.com",
    healthUrl: null,
    hosting: "Azure Web App space3-prod-chatbot (planned)",
    databaseSet: "Production",
    notes: "Planned, not deployed. No test users or credentials stored.",
    links: [],
  },
];

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { createProject } = await import("../src/lib/projects");

  let project = await prisma.project.findFirst({ where: { name: NAME }, select: { id: true } });
  if (project) {
    console.log(`Project "${NAME}" already exists; keeping it as it is.`);
  } else {
    const created = await createProject(
      {
        name: NAME,
        description: DESCRIPTION,
        type: "PROJECT",
        status: "ACTIVE",
        stage: "TESTING",
        technologies: [
          "Python",
          "FastAPI",
          "Uvicorn",
          "Microsoft Agent Framework",
          "Azure OpenAI",
          "Azure AI Search",
          "SQL Server",
          "React",
          "Azure Container Apps",
          "Azure Web Apps",
          "OpenTelemetry",
        ],
        tags: ["AI", "chatbot", "SPACE"],
        deploymentUrls: ["https://space3-uat-chatbot.azurewebsites.net"],
      },
      DOCS.map((d, i) => ({
        title: d.title,
        category: d.category,
        filePath: `[manual]/spark-${i + 1}.md`,
        content: d.content,
        source: "manual" as const,
        generatedFromContentHash: null,
      })),
    );
    project = { id: created.id };
    console.log(`Created project "${NAME}" (${created.id}).`);
  }

  const existing = await prisma.projectEnvironment.count({ where: { projectId: project.id } });
  if (existing > 0) {
    console.log(`Project already has ${existing} environment(s); not adding the starting ones.`);
  } else {
    for (const [position, env] of ENVIRONMENTS.entries()) {
      const { links, ...fields } = env;
      await prisma.projectEnvironment.create({
        data: {
          ...fields,
          projectId: project.id,
          position,
          updatedByName: "Seed",
          links: { create: links.map((l, i) => ({ ...l, position: i, updatedByName: "Seed" })) },
        },
      });
    }
    console.log(`Added ${ENVIRONMENTS.length} environments (DEV, QA, UAT, PROD).`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
