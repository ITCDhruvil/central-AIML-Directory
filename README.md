# Project Portfolio Dashboard

## Overview

This is a personal engineering/project portfolio dashboard, built to keep
POCs, projects, tools, deployments, and documentation accessible from a
single place.

V1 currently focuses on project management: a manually-maintained catalog of
projects with search, filtering, and CRUD. It is the foundation for later
phases — GitHub repository import and documentation aggregation are **not**
implemented yet; see [Current Limitations](#current-limitations) and
[Roadmap](#roadmap).

## Current Features

- Project dashboard (aggregate stats)
- Project statistics (total, active, completed, POC counts)
- Project listing
- Search (by name/description)
- Type filtering
- Status filtering
- Create project
- Edit project
- Delete project
- Project detail page
- GitHub repository URL storage
- Deployment URL storage
- Technology and tag storage
- Automatic slug generation (with de-duplication)
- Input validation
- PostgreSQL persistence

## Tech Stack

- Next.js 16.3.4 (App Router, Turbopack, Route Handlers)
- React 19.2.8
- TypeScript 5
- Tailwind CSS 4
- Prisma ORM 7.10.0
- PostgreSQL (Prisma Postgres in production)
- `pg` + `@prisma/adapter-pg` 7.10.0 (Prisma 7 requires a driver adapter — see [Development Notes](#development-notes))

## Architecture

```
Browser
  ↓
Next.js App Router
  ↓
Server Components / Route Handlers
  ↓
Prisma Client
  ↓
PostgreSQL
```

There is no separate backend service — everything runs inside one Next.js
application.

- The Dashboard, Project Detail, and Edit pages are server components that
  query Prisma directly (via `src/lib/projects.ts`).
- The Projects list page (`/projects`) is a client component that calls the
  `GET /api/projects` route handler for search/filtering, since it needs to
  re-fetch on every keystroke/filter change.
- Create/Edit/Delete all go through the `/api/projects` route handlers.

## Project Structure

```
src/app/                  Routes (pages + API route handlers)
  api/projects/            CRUD API (list/create, get/update/delete by id)
  projects/                Projects list, new, detail, edit pages
  page.tsx                 Dashboard page
  layout.tsx                Root layout + nav shell

src/components/            Reusable UI (ProjectCard, ProjectForm, badges,
                            SearchInput, EmptyState, ConfirmDialog, NavBar)

src/lib/                   Server-side logic
  prisma.ts                 Prisma Client singleton (better-sqlite3 adapter)
  projects.ts                Shared query/filter/stats logic
  projectMapper.ts            Maps a Prisma row to the app-level Project type
  slug.ts                     Slug generation + uniqueness
  validation.ts                Request body validation

src/types/project.ts       Shared Project/ProjectType/ProjectStatus types

prisma/                    schema.prisma + migrations

public/                    Static assets (default create-next-app icons)
```

## Database

PostgreSQL, accessed through Prisma. The current data models start with `Project`:

| Field            | Type              | Notes                              |
| ----------------- | ----------------- | ----------------------------------- |
| `id`               | String (cuid)      | Primary key                         |
| `name`             | String             | Required                            |
| `slug`             | String             | Unique, auto-generated from name    |
| `description`      | String?            |                                      |
| `type`             | String             | See [Project Types](#project-types) |
| `status`           | String             | See [Project Statuses](#project-statuses) |
| `githubUrl`        | String?            |                                      |
| `githubOwner`      | String?            |                                      |
| `githubRepo`       | String?            |                                      |
| `defaultBranch`    | String?            |                                      |
| `technologies`     | String             | JSON-encoded string array           |
| `tags`             | String             | JSON-encoded string array           |
| `deploymentUrls`   | String             | JSON-encoded string array           |
| `createdAt`        | DateTime           |                                      |
| `updatedAt`        | DateTime           |                                      |
| `lastSyncedAt`     | DateTime?          | Reserved for future GitHub sync     |

`type`/`status` are plain strings validated at the application level, and
`technologies`/`tags`/`deploymentUrls` are stored as JSON-encoded string
arrays (parsed back into `string[]` in `src/lib/projectMapper.ts`).

### Project Types

- `PROJECT`
- `POC`
- `EXPERIMENT`
- `TOOL`
- `OTHER`

### Project Statuses

- `ACTIVE`
- `COMPLETED`
- `ON_HOLD`
- `ARCHIVED`

## Local Development

1. **Clone**
   ```bash
   git clone <repo-url>
   cd allinone
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   This also runs `prisma generate` via the `postinstall` script.

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   See [Environment Variables](#environment-variables) — no secrets are
   required for local SQLite development.

4. **Generate Prisma Client** (already run by `postinstall`; re-run if the
   schema changes)
   ```bash
   npm run db:generate
   ```

5. **Run migrations**
   ```bash
   npm run db:migrate
   ```
   Applies `prisma/migrations/` to the database in `DATABASE_URL`.

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Open the application**
   [http://localhost:3000](http://localhost:3000)

Other scripts: `npm run build`, `npm run start` (production), `npm run lint`,
`npm run db:studio` (Prisma Studio, browse the database).

## Environment Variables

Defined in `.env.example`:

| Variable | Required | Purpose |
| ---------------- | -------- | ----------------------------------------------------------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string. Required for local and production. |
| `GITHUB_TOKEN` | No | GitHub import for private repos and higher API limits. |
| `CENTRAL-AI-PLATFORM_API-KEY` / `CENTRAL_AI_PLATFORM_API_KEY` | No | Enables Ask Project. The underscore name is the Vercel-friendly alias. |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini`. |
| `LANGSEARCH_API_KEY` | No | Live web search for Insights. |

## API

All routes are under `/api/projects` (`src/app/api/projects/`).

- **`GET /api/projects`** — List projects. Optional query params: `q`
  (matches name/description), `type`, `status`. Returns `{ projects: Project[] }`.
- **`POST /api/projects`** — Create a project. Body: project fields (see
  [Database](#database)); `slug` is generated server-side. Returns
  `201` with `{ project }`, or `400` with validation `details` on invalid input.
- **`GET /api/projects/[id]`** — Get one project by id. Returns `{ project }`
  or `404` if not found.
- **`PUT /api/projects/[id]`** — Update a project. Same body shape as
  create; re-slugs only if the name changed. `400`/`404` as above.
- **`DELETE /api/projects/[id]`** — Delete a project. Returns `204` on
  success, `404` if not found.

## Validation and Error Handling

- `name` is required
- `type` must be one of the [Project Types](#project-types)
- `status` must be one of the [Project Statuses](#project-statuses)
- `githubUrl` and each entry in `deploymentUrls`, if provided, must be a
  valid URL
- Invalid input returns `400` with a `details` object describing each field
  error
- A missing project (get/update/delete by id) returns `404`
- Unexpected errors return a generic `500` — database error details are
  never returned to the client (logged server-side only)

## Deployment

Hosted on Vercel as a Next.js app. Production uses PostgreSQL (`DATABASE_URL`).
The Vercel build runs `prisma generate`, `prisma migrate deploy`, then
`next build`. Set the environment variables from [Environment Variables](#environment-variables)
on the Vercel project (Production, Preview, and Development).

SQLite is not used in production — Vercel's filesystem is ephemeral, so a
local `dev.db` file would not persist.

## Current Limitations

This is the V1 boundary — none of the following are implemented yet:

- GitHub repository auto-import is not implemented yet.
- README ingestion is not implemented yet.
- `docs/` automatic collection is not implemented yet.
- Automatic setup-guide generation is not implemented yet.
- GitHub synchronization is not implemented yet.
- Documentation viewer is not implemented yet.
- Authentication is not implemented.
- Deployment health monitoring is not implemented.

## Roadmap

**V1** — Project management foundation — **COMPLETE**

**V1.x** — GitHub repository import
- Validate GitHub URL
- Fetch repository metadata
- Read README
- Detect technologies
- Scan repository structure

**V1.x** — Documentation aggregation
- Detect `docs/`
- Import documentation
- Categorize documents
- Documentation viewer

**V1.x** — Setup guide
- Generate setup guide from repository evidence
- Show import preview
- Allow manual review/editing

**V1.x** — GitHub sync
- Manual sync
- Preserve manual overrides
- Track last sync

**Future ideas** (not scheduled, not current functionality):
- GitHub webhooks
- Deployment health checks
- AI project assistant
- Semantic documentation search
- Project analytics

## Engineering Principles

- Keep the application simple.
- Prefer deterministic logic over AI where possible.
- Do not hallucinate project information.
- Keep imported and manually edited information distinguishable.
- Avoid unnecessary infrastructure.
- No Docker for the current version.
- No microservices for the current version.
- Verify features end-to-end before moving to the next phase.

## Development Notes

- Prisma 7 requires a driver adapter for SQL databases (no built-in engine
  binary) — this project uses `@prisma/adapter-pg` + `pg`, wired up in
  `src/lib/prisma.ts`.
- Prisma CLI config lives in `prisma7.config.ts` (Prisma 7 moved
  datasource/migration config out of `schema.prisma`), not `prisma.config.ts`.
- The installed Prisma version is pinned to **7.10.0** (stable). The
  `latest` npm dist-tag currently resolves to `8.0.0-rc.13`, a release
  candidate with broken peer dependencies — do not blindly run
  `npm install prisma@latest` / `@prisma/client@latest`.
- The generated Prisma Client (`src/generated/prisma/`) is git-ignored and
  regenerated by `npm install` (via `postinstall`) or `npm run db:generate`.
