import type { TechnologyCategory } from "@/types/technology";

// Well-known technologies and the category each belongs to. Used when a technology arrives as a plain name (typed by
// hand or sent by the chatbot) so it isn't dumped under "Other". Anything not listed here is still "Other".
const CATALOG: Record<TechnologyCategory, string[]> = {
  LANGUAGE: [
    "Python", "JavaScript", "TypeScript", "Java", "C#", "C++", "C", "Go", "Golang", "Rust", "PHP", "Ruby", "Kotlin", "Swift", "Scala",
    "R", "Dart", "SQL", "T-SQL", "PL/SQL", "Bash", "PowerShell", "HTML", "CSS", "Lua", "Elixir",
  ],
  FRAMEWORK: [
    "FastAPI", "Django", "Flask", "Next.js", "Nuxt", "Vue", "Vue.js", "Angular", "Svelte", "SvelteKit", "Express", "NestJS", "Fastify",
    "Spring", "Spring Boot", ".NET", "ASP.NET", "ASP.NET Core", "Laravel", "Rails", "Ruby on Rails", "Flutter", "React Native",
    "Microsoft Agent Framework", "Semantic Kernel", "Streamlit", "Gradio", "Electron", "Remix", "Astro",
  ],
  LIBRARY: [
    "React", "Redux", "jQuery", "Tailwind CSS", "Tailwind", "Bootstrap", "Prisma", "SQLAlchemy", "Pydantic", "Pandas", "NumPy", "SciPy",
    "Matplotlib", "Axios", "Lodash", "Zod", "Tiptap", "Material UI", "Ant Design", "Chart.js", "D3", "Three.js", "Hibernate", "Entity Framework",
  ],
  DATABASE: [
    "PostgreSQL", "Postgres", "MySQL", "MariaDB", "MongoDB", "SQLite", "SQL Server", "Microsoft SQL Server", "MSSQL", "Oracle", "Redis",
    "Elasticsearch", "OpenSearch", "Cosmos DB", "Azure Cosmos DB", "DynamoDB", "Cassandra", "Neo4j", "Firebase", "Supabase", "Snowflake", "BigQuery",
  ],
  CLOUD: [
    "Azure", "AWS", "Google Cloud", "GCP", "Vercel", "Netlify", "Heroku", "Render", "Cloudflare", "DigitalOcean",
    "Azure Container Apps", "Azure Web Apps", "Azure App Service", "Azure Functions", "Azure Blob Storage", "Azure Monitor", "Azure Key Vault",
    "Azure Kubernetes Service", "AKS", "Azure DevOps", "AWS Lambda", "Amazon S3", "EC2", "Cloud Run",
  ],
  AI_ML: [
    "OpenAI", "Azure OpenAI", "Azure AI Search", "Azure AI Foundry", "Anthropic", "Claude", "GPT", "GPT-4", "LangChain", "LlamaIndex", "TensorFlow",
    "PyTorch", "scikit-learn", "Hugging Face", "Transformers", "RAG", "Pinecone", "Weaviate", "Chroma", "Qdrant", "Ollama", "Gemini", "Mistral",
  ],
  TOOL: [
    "Docker", "Kubernetes", "Git", "GitHub", "GitHub Actions", "GitLab", "Jenkins", "Terraform", "Ansible", "OpenTelemetry", "Prometheus", "Grafana",
    "Jira", "Confluence", "Postman", "Swagger", "OpenAPI", "Vite", "Webpack", "ESLint", "Prettier", "Jest", "Vitest", "Pytest", "Playwright", "Cypress",
    "Selenium", "npm", "pnpm", "Yarn", "Poetry", "Sentry", "Datadog", "SonarQube", "Nginx",
  ],
  RUNTIME: ["Node.js", "Node", "Deno", "Bun", "Uvicorn", "Gunicorn", "Hypercorn", "Daphne", "JVM", "CLR", ".NET Runtime", "Python Runtime", "Tomcat"],
  OTHER: [],
};

const BY_NAME = new Map<string, TechnologyCategory>();
for (const [category, names] of Object.entries(CATALOG) as [TechnologyCategory, string[]][]) {
  for (const name of names) BY_NAME.set(name.toLowerCase(), category);
}

/** The category a well-known technology belongs to (case-insensitive), or "OTHER" when it isn't recognised. */
export function inferTechnologyCategory(name: string): TechnologyCategory {
  return BY_NAME.get(name.trim().toLowerCase()) ?? "OTHER";
}
