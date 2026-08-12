# StackPulse Specification

This was the specification used to build v0.4 of StackPulse; treat it as a design reference, not a live contract.

Version: 0.4
Status: MVP Specification
Architecture: Next.js 15 + PostgreSQL + Prisma + GitHub GraphQL

# 1. Project Overview

## Mission

StackPulse tracks technology adoption across a representative sample of public
JavaScript and TypeScript repositories.

StackPulse does not attempt to measure the entire JavaScript ecosystem. All
analytics are derived from the tracked repository sample.

The crawler maintains a rolling sample of repositories meeting eligibility requirements.

Repositories are discovered through recently updated repositories (see Section 9)

The sampling strategy may evolve over time.


## Glossary

| Term | Definition |
|------|-----------|
| Technology | A canonical npm package being tracked (e.g. "react") |
| Adoption | One repository using one technology |
| Snapshot | An immutable daily record of adoption counts per technology |
| Pairing | Two technologies that co-occur across repositories, with a strength score |
| Crawl | A scheduled GitHub API traversal to discover and ingest repositories |
| repoCount | Denormalized count on Technology; updated after every ingestion batch |
| Strength Score | Jaccard similarity coefficient for a pairing |

---

# 2. Goals

## Primary Goals

1. Discover technology adoption trends.
2. Explore technology usage by category.
3. Identify common technology combinations.
4. Search technologies quickly.
5. Access open public datasets.

## Non-Goals (MVP)

- Knowledge graph visualization
- Migration detection
- AI recommendations
- Multi-language ecosystem analysis
- User accounts
- Repository-level public browsing: no dedicated per-repository pages, and no full repository
  directory/search UI. (A read-only, technology-scoped "top repositories" panel of up to 10
  entries, as defined in Section 14, is in scope and is not considered repository browsing.)
---

# 3. Core Definitions

## Technology

Canonical tracked entity.

Required fields:
- slug      (URL-safe, lowercase, hyphenated; e.g. "react", "next-js")
- name      (human-readable; e.g. "React", "Next.js")
- npmPackage (exact npm registry name; e.g. "react", "next")
- category  (one of TechnologyCategory enum values)

## Adoption

One repository containing one technology.

Constraint:
A repository contributes at most one adoption per technology.
Enforced by the composite primary key @@id([repositoryId, technologyId]) on RepositoryTechnology.

## Snapshot

Daily immutable record of technology adoption counts.
Snapshots are generated once per UTC day at the end of the pipeline run. A snapshot row for the
current UTC date is mutable for the remainder of that day only — both `adoptionCount` (via
snapshot.ts, on rerun) and `trendScore` (via trends.ts, later in the same pipeline) may be
written. Once a UTC day has passed, its snapshot rows are never modified again.

---

# 4. Architecture

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React Server Components, TypeScript, Tailwind CSS |
| Backend | Next.js Route Handlers |
| Database | PostgreSQL 16+ |
| ORM | Prisma 5+ |
| Data Collection | GitHub GraphQL API v4 |
| Hosting | Vercel |
| Validation | Zod 3+ |
| Logging | Pino |

## Repository Root Structure

```
stackpulse/
├── .env.local                  # Local secrets (gitignored)
├── .env.example                # Committed template with all required keys
├── .github/
│   └── workflows/
│       └── daily-pipeline.yml
├── data/
│   └── technologies.json       # Source-of-truth technology dictionary
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
│   └── datasets/               # Exported dataset files (committed by pipeline)
│       ├── technologies.json
│       ├── repositories.json
│       └── pairings.json
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # / — homepage
│   │   ├── search/
│   │   │   └── page.tsx        # /search
│   │   ├── trending/
│   │   │   └── page.tsx        # /trending
│   │   └── technology/
│   │       └── [slug]/
│   │           └── page.tsx    # /technology/[slug]
│   ├── app/api/
│   │   ├── search/
│   │   │   └── route.ts        # GET /api/search
│   │   ├── trending/
│   │   │   └── route.ts        # GET /api/trending
│   │   └── technology/
│   │       └── [slug]/
│   │           └── route.ts    # GET /api/technology/[slug]
│   ├── lib/
│   │   ├── prisma.ts           # Singleton Prisma client
│   │   ├── github.ts           # GitHub GraphQL client + queries
│   │   ├── matcher.ts          # Technology matching logic
│   │   ├── logger.ts           # Pino logger singleton
│   │   └── rate-limit.ts       # API rate-limit middleware
│   ├── scripts/
│   │   ├── crawl.ts            # Repository crawler
│   │   ├── aggregate.ts        # Pairing aggregation
│   │   ├── snapshot.ts         # Snapshot generator
│   │   ├── trends.ts           # Trend score computation
│   │   ├── export.ts           # Dataset export
│   │   └── validate-exports.ts
│   └── types/
│       └── index.ts            # Shared TypeScript types
├── package.json
└── tsconfig.json
```

---

# 5. Environment Variables

All secrets are stored in environment variables. No secrets in source code.

## Required Variables

```
# .env.example

# GitHub Personal Access Token (classic or fine-grained, read:public_repo scope)
GITHUB_TOKEN=

# PostgreSQL connection string
DATABASE_URL=

# Optional: override default crawl batch size (default: 100)
CRAWL_BATCH_SIZE=100

# Optional: default crawl delay in ms between requests (default: 500)
CRAWL_DELAY_MS=500

# Optional: max retries per repository before skipping (default: 3)
CRAWL_MAX_RETRIES=3

# Vercel-injected at build time for dataset versioning
VERCEL_GIT_COMMIT_SHA=

# Optional: max wall-clock duration for one crawl.ts invocation, in ms
# (default: 5400000 / 90 min, leaving ~30 min of the 120-min GitHub Actions job timeout for the rest of the pipeline)
CRAWL_MAX_DURATION_MS=5400000

# Required in production for rate limiting (Vercel KV / Upstash Redis).
# If unset, rate limiting middleware no-ops (allows all requests) — used for local development.
KV_REST_API_URL=
KV_REST_API_TOKEN=

# Separate database used only by the Vitest integration suite (Section 17). Migrations run
# against this database before tests execute; never points at the same database as DATABASE_URL.
TEST_DATABASE_URL=

```

---

# 6. Project Principles

1. Analytics are precomputed; no aggregation runs during HTTP requests.
2. Pairings are computed by the daily pipeline, never during requests.
3. Trends are computed by the daily pipeline, never during requests.
4. All ingestion operations are idempotent (safe to re-run).
5. Long-running jobs are resumable via persisted CrawlState cursor.
6. Cached analytics (repoCount, TrendingSnapshot, TechnologyPairing) are the
   source of truth for UI rendering.
7. Analytics must be deterministic given the same raw data.
8. Every aggregation must be reproducible from raw RepositoryTechnology rows.

---

# 7. Data Model

## Enums

```prisma
enum TechnologyCategory {
  Frameworks
  Databases
  ORMs
  Validation
  Testing
  Authentication
  BuildTools
  StateManagement
  UILibraries
}

enum CrawlJobStatus {
  queued
  running
  completed
  failed
}
```

## Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Technology {
  id          String             @id @default(uuid())
  slug        String             @unique
  name        String
  npmPackage  String             @unique
  category    TechnologyCategory
  description String?
  isActive    Boolean            @default(true)
  repoCount   Int                @default(0)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  repositories  RepositoryTechnology[]
  snapshotsA    TrendingSnapshot[]
  pairingsA     TechnologyPairing[]    @relation("PairingA")
  pairingsB     TechnologyPairing[]    @relation("PairingB")
}

model Repository {
  id              String   @id @default(uuid())
  githubId        BigInt   @unique
  fullName        String   @unique
  url             String
  stars           Int      @default(0)
  defaultBranch   String   @default("main")
  lastPushedAt    DateTime?
  lastCrawledAt   DateTime?
  packageJsonSha  String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  technologies    RepositoryTechnology[]
}

model RepositoryTechnology {
  repositoryId   String
  technologyId   String
  repository     Repository @relation(fields: [repositoryId], references: [id])
  technology     Technology @relation(fields: [technologyId], references: [id])

  @@id([repositoryId, technologyId])
}

model TechnologyPairing {
  technologyAId   String
  technologyBId   String
  repositoryCount Int
  strengthScore   Float
  updatedAt       DateTime @updatedAt

  technologyA     Technology @relation("PairingA", fields: [technologyAId], references: [id])
  technologyB     Technology @relation("PairingB", fields: [technologyBId], references: [id])

  @@id([technologyAId, technologyBId])
  // Invariant: technologyAId < technologyBId (enforced in application code)
}

model TrendingSnapshot {
  technologyId  String
  snapshotDate  DateTime @db.Date
  adoptionCount Int
  trendScore    Float    @default(0)
  technology    Technology @relation(fields: [technologyId], references: [id])

  @@id([technologyId, snapshotDate])
}

model CrawlState {
  id            Int      @id @default(1)  // singleton row
  activeWindow  Int      @default(1)      // index into the search-slot list (see Section 9) — 10 slots total: 5 star-ranges × 2 languages
  cursors       Json     @default("{}")   // map of slot index -> cursor, e.g. {"1": "Y3Vyc29y...", "10": null}
  updatedAt     DateTime @updatedAt
}

model CrawlJob {
  id                    String        @id @default(uuid())
  status                CrawlJobStatus
  repositoriesProcessed Int           @default(0)
  repositoriesMatched   Int           @default(0)
  errors                Int           @default(0)
  startedAt             DateTime?
  completedAt           DateTime?
  createdAt             DateTime      @default(now())
}
```

---

# 8. Technology Dictionary

## Location

`/data/technologies.json`

## Schema

```ts
// Each entry in technologies.json
interface TechnologyEntry {
  slug: string;        // URL-safe, lowercase, hyphen-separated
  name: string;        // Display name
  npmPackage: string;  // Exact npm package name used in package.json
  category: TechnologyCategory;
  description?: string;
}
```

## Example Entries

```json
[
  {
    "slug": "react",
    "name": "React",
    "npmPackage": "react",
    "category": "Frameworks",
    "description": "The library for web and native user interfaces."
  },
  {
    "slug": "prisma",
    "name": "Prisma",
    "npmPackage": "prisma",
    "category": "ORMs",
    "description": "Next-generation ORM for Node.js and TypeScript."
  }
]
```

## Sourcing the Full Dictionary

The 150+ entry dictionary is NOT generated by the implementing agent. It is
 provided as a complete `data/technologies.json` file before implementation begins

## Rules

- Minimum 150 entries required for MVP completion.
- One canonical entry per npmPackage.
- Slug must be unique and URL-safe.
- Adding, renaming, or deactivating technology entries only requires re-running prisma db seed — no schema migration needed. A migration is required only when a dictionary change introduces a new TechnologyCategory enum value.
- Removed technologies are soft-retained: prisma/seed.ts sets isActive = false on any existing
  Technology row whose slug is absent from data/technologies.json (it is never deleted). Inactive
  technologies remain queryable via /api/technology/[slug] and retain their historical
  RepositoryTechnology, TrendingSnapshot, and TechnologyPairing rows, but are excluded from
  /api/search and /api/trending results.
- New entries are seeded via `prisma/seed.ts`, which upserts on slug.
- The TechnologyCategory enum (Section 7) is considered closed for MVP. If the supplied
  data/technologies.json contains entries that do not map cleanly onto an existing category,
  resolving that is part of the "Prisma migration review" already required for dictionary
  changes — no additional category-mapping process exists.

## Seeding

```ts
// prisma/seed.ts (scaffold)
import { PrismaClient } from '@prisma/client';
import technologies from '../data/technologies.json';

const prisma = new PrismaClient();

async function main() {
  const incomingSlugs = technologies.map(t => t.slug);

  for (const tech of technologies) {
    await prisma.technology.upsert({
      where: { slug: tech.slug },
      update: { name: tech.name, npmPackage: tech.npmPackage,
                category: tech.category, description: tech.description ?? null,
                isActive: true },
      create: tech,
    });
  }

  await prisma.technology.updateMany({
    where: { slug: { notIn: incomingSlugs } },
    data: { isActive: false },
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

Run with: `npx prisma db seed`

---

# 9. Crawling System

## Repository Eligibility

| Criterion | Requirement |
|-----------|-------------|
| Visibility | Public |
| Language | JavaScript or TypeScript (primary language) |
| Stars | > 10 |
| package.json | Present at root of default branch |

Exclude:
- forks
- archived repositories
- disabled repositories
- empty repositories

## GitHub GraphQL Query

GitHub's repository search does not support boolean `OR` grouping across `language:`
qualifiers — repeating the qualifier is ANDed, not ORed, so a single query cannot match
"JavaScript or TypeScript" directly. To cover both languages, the crawler partitions
discovery into **10 slots**: the 5 star-range windows (Section 9) crossed with the 2
languages. $searchQuery is assembled in application code per the active slot, substituting
the star range and a single `language:` qualifier, e.g.
`language:TypeScript stars:11..100 fork:false archived:false sort:updated` for the
TypeScript slot of Window 5.


```graphql
query DiscoverRepositories($cursor: String, $batchSize: Int!, $searchQuery: String!) {
  search(
    query: $searchQuery
    type: REPOSITORY
    first: $batchSize
    after: $cursor
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      ... on Repository {
        databaseId
        nameWithOwner
        url
        stargazerCount
        isDisabled
        isEmpty
        defaultBranchRef { name }
        pushedAt
        object(expression: "HEAD:package.json") {
          ... on Blob { oid text }
        }
      }
    }
  }
}
```

Note: `object(expression: "HEAD:package.json")` fetches the file inline.
If `object` is null, the repository has no root package.json and is skipped.

## Crawl Workflow (per batch)

1. Load cursor from CrawlState.
2. Execute the GraphQL query for the active window with `first = Math.min(Number(process.env.CRAWL_BATCH_SIZE ?? 100), 100)` and `after = cursor`.
3. For each repository node:
   a. Skip if isDisabled or isEmpty is true.
   b. Skip if object (package.json) is null.
   c. Look up the existing Repository row by githubId. If it exists and its stored packageJsonSha equals the freshly-fetched object.oid, skip technology matching and the RepositoryTechnology diff for this repository; only refresh stars, lastPushedAt, and lastCrawledAt. Otherwise, continue to parse package.json and proceed with matching.
   d. Parse package.json text.
     If package.json cannot be parsed as valid JSON:
      - increment CrawlJob.errors
      - log the error via Pino
      - skip the repository
      - continue processing
   e. Match technologies from dependency fields.
   f. Record the technologyId as affected for this batch (no direct repoCount write here).
   g. Diff and update RepositoryTechnology rows (transaction).
4. After all repositories in the batch are processed, recompute repoCount once for every
   technologyId affected during this batch (see "repoCount Update", Section 10). repoCount is
   never incremented/decremented per-repository.
5. Save endCursor to CrawlState.
6. Log batch metrics to CrawlJob.
7. Repeat until any of the following: hasNextPage is false for the active window (advance to the
   next window and continue), the run's elapsed time exceeds CRAWL_MAX_DURATION_MS (save cursor
   and exit 0).

## CrawlJob Lifecycle

One CrawlJob row is created per crawl.ts invocation:
1. At script start: create row with status=queued, startedAt unset.
2. Immediately after: update status=running, startedAt=now().
3. After each batch: increment repositoriesProcessed, repositoriesMatched, and errors on this
   same row.
4. On clean exit (time budget reached — slots wrap continuously per Section 9 and are never collectively "exhausted"): status=completed, completedAt=now().
5. On unhandled error: status=failed, completedAt=now(), error logged via Pino.

## Idempotency

Re-running a crawl on the same repository must produce identical results.
The diff-and-update approach ensures stale relationships are removed and only
current ones persist. packageJsonSha is stored to detect unchanged files and
skip re-processing when possible.

Because windows are queried with `sort:updated`, the position a cursor points to can shift
between runs as repositories outside the current page are updated. This may cause a small number
of repositories to be skipped or revisited across runs within a window. This is an accepted
characteristic of the rolling-sample design (Section 1) and is not treated as a correctness bug.

## Rate Limiting and Backoff

```ts
// Pseudocode for request retry logic
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithBackoff<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === retries) throw err;

      if (err.status === 403 && err.headers?.['retry-after']) {
        const retryAfterMs = Number(err.headers['retry-after']) * 1000;
        await delay(retryAfterMs);
        continue;
      }

      const backoff = Math.min(500 * 2 ** attempt + Math.random() * 200, 30_000);
      await delay(backoff);
    }
  }
  throw new Error('Unreachable');
}
```

- Default inter-request delay: `CRAWL_DELAY_MS` (default 500ms).
- On GitHub secondary rate limit (HTTP 403 + Retry-After header): wait for the
  indicated duration before retrying.
- On transient errors: exponential backoff with jitter, max 30s.
- After `CRAWL_MAX_RETRIES` failures on one repository: log, increment
  CrawlJob.errors, and continue to next repository.

## Search Windowing

GitHub's Search API returns a maximum of 1,000 results (10 pages × 100) per query, regardless
of pagination depth. To assemble a sample larger than 1,000 repositories, the crawler partitions
discovery into multiple star-count windows, each queried and paginated independently. Because
GitHub search also ANDs repeated `language:` qualifiers rather than ORing them (see Section 9's
GraphQL Query note), each star-count window is further split by language, giving **10 slots**
total:

| Window | Star range | Slot A (language) | Slot B (language) |
|--------|-----------|--------------------|--------------------|
| 1 | stars:>100000 | JavaScript | TypeScript |
| 2 | stars:10001..100000 | JavaScript | TypeScript |
| 3 | stars:1001..10000 | JavaScript | TypeScript |
| 4 | stars:101..1000 | JavaScript | TypeScript |
| 5 | stars:11..100 | JavaScript | TypeScript |

Slots are numbered 1-10 (e.g. Window 1/JavaScript = slot 1, Window 1/TypeScript = slot 2, ...
Window 5/TypeScript = slot 10) and `CrawlState.activeWindow` indexes into this flat slot list.

The crawler processes one slot at a time, in order, paginating with `sort:updated` until
`hasNextPage` is false or the run's time budget is exhausted. When a slot is exhausted, the
crawler advances to the next slot (wrapping back to slot 1 after the last). Each slot persists
its own cursor in `CrawlState.cursors` (Section 7). When a slot's pagination is exhausted
(`hasNextPage` is false), its cursor entry is cleared before advancing, so the next time that
slot comes up in rotation it restarts from the top of the sorted results.

Because GitHub search ordering changes over time, repositories may be revisited or skipped
between runs. This behavior is accepted as part of the rolling-sample design and is not
considered a correctness issue.

## Repository Retention

Repository rows are never automatically deleted.

If a repository later becomes archived,
disabled, loses package.json,
or otherwise fails eligibility requirements:

- RepositoryTechnology relationships are updated normally.
- Repository metadata continues to be retained.
- Historical snapshots remain unchanged.


---

# 10. Ingestion Pipeline

## Dependency Sources (from package.json)

| Field | Included |
|-------|---------|
| dependencies | ✅ Yes |
| devDependencies | ✅ Yes |
| peerDependencies | ✅ Yes |
| optionalDependencies | ❌ No |
| bundledDependencies | ❌ No |

## Matching Logic

```ts
// src/lib/matcher.ts (scaffold)
import technologies from '../../data/technologies.json';

const packageIndex = new Map(technologies.map(t => [t.npmPackage, t.slug]));
export function matchTechnologies(packageJson: Record<string, unknown>): string[] {
  const deps = {
    ...(packageJson['dependencies'] as Record<string, string> ?? {}),
    ...(packageJson['devDependencies'] as Record<string, string> ?? {}),
    ...(packageJson['peerDependencies'] as Record<string, string> ?? {}),
  };
  
  const matched: string[] = [];
  for (const pkg of Object.keys(deps)) {
    const slug = packageIndex.get(pkg);
    if (slug) matched.push(slug);
  }
  return [...new Set(matched)]; // deduplicate
}
```

## Repository Update Transaction

```ts
// Pseudocode for atomic ingestion
await prisma.$transaction(async (tx) => {
  // 1. Upsert repository
  const repo = await tx.repository.upsert({ ... });

  // 2. Resolve matched technology IDs
  const techIds = await tx.technology.findMany({
    where: { slug: { in: matchedSlugs } },
    select: { id: true },
  });

  // 3. Load existing relationships
  const existing = await tx.repositoryTechnology.findMany({
    where: { repositoryId: repo.id },
  });

  // 4. Diff
  const existingIds = new Set(existing.map(r => r.technologyId));
  const newIds = new Set(techIds.map(t => t.id));
  const toRemove = [...existingIds].filter(id => !newIds.has(id));
  const toAdd = [...newIds].filter(id => !existingIds.has(id));

  // 5. Remove stale
  if (toRemove.length) {
    await tx.repositoryTechnology.deleteMany({
      where: { repositoryId: repo.id, technologyId: { in: toRemove } },
    });
  }

  // 6. Insert new
  if (toAdd.length) {
    await tx.repositoryTechnology.createMany({
      data: toAdd.map(technologyId => ({ repositoryId: repo.id, technologyId })),
      skipDuplicates: true,
    });
  }
});

// 7. Update repoCount (outside transaction, via raw aggregation)
await recomputeRepoCounts(affectedTechIds);
```

## repoCount Update

After each batch completes, recompute repoCount for affected technologies:

```ts
await prisma.$executeRaw`
  UPDATE "Technology" t
  SET "repoCount" = (
    SELECT COUNT(*) FROM "RepositoryTechnology" rt WHERE rt."technologyId" = t.id
  )
  WHERE t.id = ANY(${affectedTechIds}::uuid[])
`;
```

---

## Ordering Guarantee

`repoCount` must be fully recomputed for all affected technologies before
`aggregate.ts` runs. The pipeline (Section 16) enforces this by running
`crawl.ts` to completion (which recomputes repoCount per batch) before
invoking `aggregate.ts` as a separate, later step. aggregate.ts must never
run concurrently with crawl.ts.

# 11. Analytics

## Pairing Aggregation

Frequency: Daily, after crawl completes.
Trigger: Explicit script call in pipeline (`npm run aggregate`).

### Algorithm

To avoid the performance trap of an O(N²) loop executing tens of thousands of individual database roundtrips, the pairing aggregation must be executed in a single, set-based PostgreSQL batch query.

```ts
// src/scripts/aggregate.ts
import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info({ service: 'aggregate', operation: 'pairing_aggregation', status: 'running' });
  const startTime = Date.now();

  // Execute a single set-based bulk upsert via raw SQL
  const updatedRows = await prisma.$executeRaw`
    INSERT INTO "TechnologyPairing" ("technologyAId", "technologyBId", "repositoryCount", "strengthScore", "updatedAt")
    SELECT 
      LEAST(ra."technologyId", rb."technologyId") as tA,
      GREATEST(ra."technologyId", rb."technologyId") as tB,
      COUNT(ra."repositoryId") as repo_count,
      -- Jaccard Similarity Coefficient formula: |A ∩ B| / (|A| + |B| - |A ∩ B|)
      CAST(COUNT(ra."repositoryId") AS FLOAT) / (ta."repoCount" + tb."repoCount" - COUNT(ra."repositoryId")) as strength,
      NOW()
    FROM "RepositoryTechnology" ra
    JOIN "RepositoryTechnology" rb ON ra."repositoryId" = rb."repositoryId" AND ra."technologyId" < rb."technologyId"
    JOIN "Technology" ta ON ta.id = ra."technologyId"
    JOIN "Technology" tb ON tb.id = rb."technologyId"
    GROUP BY tA, tB, ta."repoCount", tb."repoCount"
    ON CONFLICT ("technologyAId", "technologyBId") 
    DO UPDATE SET 
      "repositoryCount" = EXCLUDED."repositoryCount", 
      "strengthScore" = EXCLUDED."strengthScore", 
      "updatedAt" = NOW();
  `;

  // Zero out any pairing not touched by this run — its repositories no longer co-occur.
  await prisma.$executeRaw`
    UPDATE "TechnologyPairing"
    SET "repositoryCount" = 0, "strengthScore" = 0, "updatedAt" = NOW()
    WHERE "updatedAt" < ${new Date(startTime)}
  `;

  const durationMs = Date.now() - startTime;
  logger.info({ 
    service: 'aggregate', 
    operation: 'pairing_aggregation', 
    durationMs, 
    status: 'success',
    metrics: { pairsUpdated: updatedRows }
  });
}

main()
  .catch((err) => {
    logger.error({ service: 'aggregate', operation: 'pairing_aggregation', status: 'error', error: err.message });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

## Snapshot Generation

Frequency: Daily, after aggregation.

```ts
// scripts/snapshot.ts (scaffold)
const today = new Date();
today.setUTCHours(0, 0, 0, 0);

const techs = await prisma.technology.findMany({ select: { id: true, repoCount: true } });

for (const t of techs) {
  await prisma.trendingSnapshot.upsert({
    where: { technologyId_snapshotDate: { technologyId: t.id, snapshotDate: today } },
    update: { adoptionCount: t.repoCount },
    create: { technologyId: t.id, snapshotDate: today, adoptionCount: t.repoCount, trendScore: 0 },
  });
}

```

## Trend Score Computation

Frequency: Daily, after snapshots.

A technology is eligible for trend scoring if it has at least 3 TrendingSnapshot rows dated
strictly before today's UTC date (today's own newly-created row does not count toward this
threshold).

Implementation Note

trends.ts operates on the technology dictionary (hundreds of rows), not the repository table
(thousands+), so a per-technology loop is acceptable for MVP and does not require the set-based
rewrite used in aggregate.ts. However, implementations must fetch each technology's snapshot
history in a single batched query up front (e.g. one findMany across all technologyIds for the
last 30+ days) and compute eligibility/previous-value lookups in memory, rather than issuing
separate count/findFirst queries per technology inside the loop.


```ts
// Formula
const trendScore = (current / Math.max(previous, 1)) * Math.log10(current + 10);
```

- `current` = adoptionCount for today's snapshot.
- `previous` = adoptionCount from the snapshot 30 days prior (or oldest
  available if < 30 days of history).
- Technologies with current < 10 are assigned trendScore = 0 and excluded from
  trending listings.
- Scores are stored on TrendingSnapshot.trendScore.

```ts
// scripts/trends.ts (scaffold)
const today = new Date(); today.setUTCHours(0, 0, 0, 0);
const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30);

// Single batched fetch: all snapshot history needed for every technology.
const allSnapshots = await prisma.trendingSnapshot.findMany({
  where: { snapshotDate: { lte: today } },
  orderBy: { snapshotDate: 'asc' },
});

// Group in memory by technologyId.
const byTech = new Map<string, typeof allSnapshots>();
for (const s of allSnapshots) {
  const list = byTech.get(s.technologyId) ?? [];
  list.push(s);
  byTech.set(s.technologyId, list);
}

const updates: { technologyId: string; snapshotDate: Date; trendScore: number }[] = [];

for (const [technologyId, history] of byTech) {
  const todaySnap = history.find(s => s.snapshotDate.getTime() === today.getTime());
  if (!todaySnap) continue;

  const priorRows = history.filter(s => s.snapshotDate.getTime() < today.getTime());
  if (priorRows.length < 3) continue;          // eligibility: ≥3 rows strictly before today
  if (todaySnap.adoptionCount < 10) continue;   // below threshold -> trendScore stays 0

  // previous = snapshot ~30 days prior, or oldest available if history < 30 days
  const atOrBefore30 = priorRows.filter(s => s.snapshotDate.getTime() <= thirtyDaysAgo.getTime());
  const prev = atOrBefore30.length > 0
    ? atOrBefore30[atOrBefore30.length - 1]   // closest to 30 days ago (rows sorted asc)
    : priorRows[0];                            // oldest available

  const previous = prev?.adoptionCount ?? 0;
  const score = (todaySnap.adoptionCount / Math.max(previous, 1))
                * Math.log10(todaySnap.adoptionCount + 10);

  updates.push({ technologyId, snapshotDate: today, trendScore: score });
}

for (const u of updates) {
  await prisma.trendingSnapshot.update({
    where: { technologyId_snapshotDate: { technologyId: u.technologyId, snapshotDate: u.snapshotDate } },
    data: { trendScore: u.trendScore },
  });
}
```

---

# 12. API Contracts

All endpoints return `Content-Type: application/json`.
All inputs are validated with Zod before any DB access.
All endpoints are rate-limited (see Section 13).

## GET /api/search?q=:query

### Zod Validation

```ts
const SearchSchema = z.object({
  q: z.string().trim().min(1).max(100),
});
```

### Response

```ts
// 200 OK
{
  "results": [
    {
      "slug": "react",
      "name": "React",
      "category": "Frameworks",
      "repoCount": 8241,
      "description": "The library for web and native user interfaces."
    }
    // ...up to 20 results
  ]
}
```

### Rules

- Case-insensitive prefix match on `name` and `slug`.
- Ordered by `repoCount DESC`.
- Limit 20 results.
- Query: `WHERE "isActive" = true AND (lower(slug) LIKE lower(:q) || '%' OR lower(name) LIKE lower(:q) || '%')`
- Matching is performed only against stored slug and name values. No fuzzy matching, punctuation normalization, stemming, tokenization, or typo correction is performed.


### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing or invalid `q` parameter |
| 429 | Rate limit exceeded |

---

## GET /api/trending?limit=:n

### Zod Validation

```ts
const TrendingSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
```

### Response

```ts
// 200 OK
{
  "technologies": [
    {
      "slug": "bun",
      "name": "Bun",
      "category": "BuildTools",
      "repoCount": 1230,
      "trendScore": 3.47
    }
    // ...up to `limit` results
  ],
  "snapshotDate": "2025-01-15"
}
```

### Rules

- Use the most recent snapshotDate for which at least one TrendingSnapshot row has trendScore > 0. If today's snapshot contains at least one row with trendScore > 0, use today's date. Otherwise use the most recent earlier snapshotDate meeting the same condition.
- Ordered by `trendScore DESC`.
- Excludes technologies with trendScore = 0 (< 10 adoptions or no score yet).
- Excludes technologies where isActive = false.
- If no TrendingSnapshot row anywhere has trendScore > 0, return { "technologies": [], "snapshotDate": null } with a 200 status.

---

## GET /api/technology/:slug

### Zod Validation

```ts
const SlugSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
});
```

### Response

```ts
// 200 OK
{
  "technology": {
    "slug": "react",
    "name": "React",
    "category": "Frameworks",
    "description": "...",
    "repoCount": 8241,
    "trendScore": 2.91   // from latest TrendingSnapshot; 0 if the technology has no snapshot rows yet
  },
  "pairings": [
    {
      "slug": "typescript",
      "name": "TypeScript",
      "repositoryCount": 7100,
      "strengthScore": 0.86
    }
    // ...up to 10 pairings, ordered by strengthScore DESC
  ],
  "topRepositories": [
    {
      "fullName": "vercel/next.js",
      "url": "https://github.com/vercel/next.js",
      "stars": 120000
    }
  "snapshots": [
    { "date": "2025-01-15", "adoptionCount": 8241 }
    // ascending order, one entry per day with a TrendingSnapshot row, last 30 days
    
    // ...up to 10 repos, ordered by stars DESC
  ]
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Invalid slug format |
| 404 | Technology not found |
| 429 | Rate limit exceeded |


## Generic Error Responses

All endpoints return this shape for unhandled errors:

```ts
// 500 Internal Server Error
{ "error": "Internal server error" }
```

Full error details (stack trace, message) are logged server-side via Pino
and never included in the response body.

## Rules

Inactive technologies remain accessible through
/api/technology/[slug].

404 is returned only when no Technology row exists
for the requested slug.


---

# 13. Rate Limiting

Apply to all `/api/*` routes.

```ts
// src/lib/rate-limit.ts
// Vercel functions are stateless/serverless — in-memory counters do NOT
// persist across invocations and will not enforce limits correctly.
// MVP uses Vercel KV (or Upstash Redis) with a sliding-window counter.
//
// Required env var: KV_REST_API_URL, KV_REST_API_TOKEN (Vercel KV)
//
// Limits:
// - Search: 60 requests / minute per IP
// - Trending: 60 requests / minute per IP
// - Technology page: 60 requests / minute per IP
//
// On limit exceeded: respond 429 with header Retry-After: 60
```

Response on limit exceeded:

```json
{ "error": "Too many requests. Please retry after 60 seconds." }
```

Headers on all API responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: <n>
X-RateLimit-Reset: <unix timestamp>
```

---

# 14. Pages

## Routes

| Path | Component |
|------|-----------|
| / | Homepage — search bar, category grid, trending preview |
| /search | Search results page |
| /trending | Full trending list |
| /trending/weekly | Weekly breakout |
| /technology/[slug] | Technology detail page |

## Data Fetching

- `/search`, `/trending`, `/technology/[slug]` pages are React Server
  Components that call the corresponding internal API route handler
  directly via fetch to an absolute URL built from `process.env.VERCEL_URL`
  (or `localhost:3000` in dev) — not via direct Prisma calls from the page.
- This keeps a single data-access path (the API route) for both the UI and
  any external consumer of the API.

## Technology Detail Page Sections

1. Header: name, category badge, npm package link.
2. Adoption count + trend score + trend direction indicator.
3. Pairings: top 10 by strength score, with mini strength bar.
4. Top repositories: top 10 by stars.
5. Trend chart: sparkline of snapshots over last 30 days.
  - Do not install heavy client-side charting libraries (e.g., Chart.js, Recharts) that conflict with Next.js 15 Server Components.
  - Implement the 30-day trend sparkline as a lightweight, zero-dependency SVG component rendered directly on the server, or use standard tailwind-styled elements.

All sections are populated from the single `GET /api/technology/[slug]`
response — the page makes no additional data calls.

## Empty and Error States

- Search with no results: "No technologies match your search."
- Trending with no data: "Trend data not yet available. Check back after the next pipeline run."
- Technology page 404: Standard Next.js not-found page with link back to search.
- API errors: Display inline error message, do not crash the page.

---

# 15. Dataset Export

Generated daily by `scripts/export.ts`.
Output path: `public/datasets/`

## File Schemas

### technologies.json

```ts
{
  "version": "1.0",
  "generatedAt": "2025-01-15T02:00:00Z",
  "commitSha": "abc123",
  "technologies": [
    {
      "slug": "react",
      "name": "React",
      "npmPackage": "react",
      "category": "Frameworks",
      "description": "The library for web and native user interfaces.",
      "repoCount": 8241
    }
  ]
}
```

### repositories.json

export only repository metadata needed for public pages.
Only repositories with at least 1 matched technology are included.
Maximum 10,000 repositories, ordered by `stars DESC`, to bound file size.


```ts
{
  "version": "1.0",
  "generatedAt": "2025-01-15T02:00:00Z",
  "repositories": [
    {
      "fullName": "vercel/next.js",
      "url": "https://github.com/vercel/next.js",
      "stars": 120000,
      "technologies": ["react", "next-js"]   // slugs
    }
  ]
}
```

### pairings.json

```ts
{
  "version": "1.0",
  "generatedAt": "2025-01-15T02:00:00Z",
  "pairings": [
    {
      "technologyA": "react",
      "technologyB": "typescript",
      "repositoryCount": 7100,
      "strengthScore": 0.86
    }
  ]
}
```

## Rules

- `version` and `generatedAt` are required on all files.
- Schema changes must be backward-compatible (additive only).
- Files are validated post-export (validate step in pipeline).
- Files are committed to the repository by the GitHub Actions workflow.
- `technologies.json` excludes technologies where isActive = false.
- `pairings.json` excludes any pairing where either technologyA or technologyB is inactive.

## Export Validation

`scripts/validate-exports.ts` runs after export and before commit. For each
file in `public/datasets/`:

1. Parse as JSON (fail if malformed).
2. Assert `version` and `generatedAt` fields are present and non-empty.
3. Assert the top-level array (`technologies` / `repositories` / `pairings`)
   is present and has length > 0.
4. Assert every entry has all required fields per its schema (Section 15).
5. Exit code 1 on any failure, which fails the GitHub Actions step and
   blocks the commit step.
   
---

# 16. Automation

## GitHub Actions Workflow

```yaml
# .github/workflows/daily-pipeline.yml
name: Daily Pipeline

on:
  schedule:
    - cron: '0 2 * * *'    # 02:00 UTC daily
  workflow_dispatch:         # Allow manual trigger

jobs:
  pipeline:
    runs-on: ubuntu-latest
    timeout-minutes: 120

steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Crawl repositories
        run: npm run crawl
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          GITHUB_TOKEN: ${{ secrets.GH_PAT }}

      - name: Aggregate pairings
        run: npm run aggregate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Generate snapshots
        run: npm run snapshot
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Compute trends
        run: npm run trends
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Export datasets
        run: npm run export
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          VERCEL_GIT_COMMIT_SHA: ${{ github.sha }}

      - name: Validate exports
        run: npm run validate-exports

      - name: Commit datasets
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: update datasets [skip ci]'
          file_pattern: 'public/datasets/*.json'
```

## Pipeline Guarantees

- Every step is resumable: re-running a completed step is idempotent.
- A failure in one step does not block later steps where the later step can
  degrade gracefully (e.g. if aggregation fails, snapshot still runs with
  stale data). Critical failures (crawl, DB connection) abort the pipeline.
- All steps log start/end timestamps and row counts.
- Graceful degradation is implemented inside each script, not via GitHub Actions configuration:
  aggregate.ts, snapshot.ts, trends.ts, and export.ts each catch their own internal errors, log
  them via Pino, and exit 0 so the next pipeline step still runs with whatever data is available.
  Only crawl.ts and a failed initial DB connection (in any script) are treated as critical and
  exit 1, which is allowed to halt the workflow via GitHub Actions' default step-failure behavior.
- Pipeline Order:
  1. `migrate` — Run prisma migrate deploy
  2. `crawl` — Discovery-oriented repository traversal (crawl.ts)
  3. `refresh` — Maintenance-oriented repository refresh (refresh.ts)
  4. `aggregate` — Compute technology pairings (aggregate.ts)
  5. `snapshot` — Generate daily snapshots (snapshot.ts)
  6. `trends` — Compute trend scores (trends.ts)
  7. `export` — Generate and commit datasets (export.ts)
  8. `validate-exports` — Validate exported dataset schemas
  9. `monitor` — Non-blocking integrity check (monitor_stale.ts). This is the final step and intentionally non-blocking; its failure does not halt the pipeline.


# 17. Testing

## Unit Tests

| Test | File | Covers |
|------|------|--------|
| Dictionary matching | matcher.test.ts | All dep fields, deduplication, unknown packages |
| Deduplication | matcher.test.ts | UNIQUE constraint enforcement in matching output |
| Trend calculation | trends.test.ts | Formula correctness, edge cases (0 previous, < 10) |
| Pairing calculation | aggregate.test.ts | Jaccard formula, tA < tB ordering invariant |

## Integration Tests

| Test | Covers |
|------|--------|
| Repository ingestion | Full upsert cycle, diff logic, repoCount update |
| API /api/search | Zod validation, prefix match, ordering, 400/429 |
| API /api/trending | Snapshot fallback, limit param, ordering |
| API /api/technology/[slug] | 404 path, response shape, pairings |
| Export generation | File schema validation, required fields |

## Test Framework

- Vitest (fast, native TypeScript)
- Use a separate test database; run migrations before test suite

---

# 18. Observability

## Structured Log Format (Pino)

```ts
logger.info({
  service: 'crawl',          // crawl | aggregate | snapshot | trends | export | api
  operation: 'ingest_repo',  // human-readable operation name
  durationMs: 142,
  status: 'success',         // success | error | skipped
  jobId: 'abc-123',
  repoFullName: 'vercel/next.js',
});
```

## Required Metrics to Log

| Metric | Where |
|--------|-------|
| Crawl duration (total) | crawl.ts end |
| Repositories processed | per batch and total |
| Repositories matched (≥1 technology) | per batch and total |
| Failed repositories | per repository + total |
| Aggregation duration | aggregate.ts end |
| Snapshot count generated | snapshot.ts end |
| API request latency | all route handlers |
| API 4xx/5xx counts | all route handlers |
| Export file sizes | export.ts end |

---

# 19. Performance

## Response Time Targets

| Endpoint | p95 Target |
|----------|-----------|
| /api/search | < 100ms |
| /api/technology/[slug] | < 300ms |
| /api/trending | < 300ms |

## Database Indexes

Add the following indexes in migration(s):

```sql
-- Search: prefix match on slug and name
CREATE INDEX idx_technology_slug_prefix ON "Technology" (lower(slug) text_pattern_ops);
CREATE INDEX idx_technology_name_prefix ON "Technology" (lower(name) text_pattern_ops);
CREATE INDEX idx_technology_repo_count ON "Technology"("repoCount" DESC);

-- Trending: date-ordered snapshots
CREATE INDEX idx_snapshot_date ON "TrendingSnapshot"("snapshotDate" DESC, "trendScore" DESC);
CREATE INDEX idx_snapshot_tech_date ON "TrendingSnapshot"("technologyId", "snapshotDate" DESC);

-- Pairings: lookups by either technology
CREATE INDEX idx_pairing_a ON "TechnologyPairing"("technologyAId");
CREATE INDEX idx_pairing_b ON "TechnologyPairing"("technologyBId");

-- Repository technology lookups
CREATE INDEX idx_repo_tech_tech ON "RepositoryTechnology"("technologyId");
```

## Constraints

- No runtime aggregation queries (GROUP BY, COUNT across full table) in any HTTP request path.
- Use `repoCount` (denormalised) for all listing and search queries.
- Use `trendScore` from TrendingSnapshot for all trending queries.

---

# 20. Security

- Validate all API inputs with Zod before any DB access.
- Rate-limit all public `/api/*` routes (see Section 13).
- Sanitize dataset exports: exclude internal UUIDs, include only public fields.
- Store all secrets exclusively in environment variables; never in source code
  or committed files.
- Prisma parameterized queries prevent SQL injection by default; use raw
  queries only where necessary and always with parameterized placeholders.
- API responses do not expose internal error details; log full errors server-side.
- GitHub token: for fine-grained PATs, select "Public Repositories (read-only)" access (no other
  permissions needed).
---

# 21. Local Development Setup

Target: fully running development environment in < 15 minutes.

## Steps

```bash
# 1. Clone the repo
git clone https://github.com/your-org/stackpulse && cd stackpulse

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env.local
# Fill in DATABASE_URL and GITHUB_TOKEN

# 4. Start local PostgreSQL (requires Docker)
docker run -d --name stackpulse-db \
  -e POSTGRES_DB=stackpulse \
  -e POSTGRES_USER=stackpulse \
  -e POSTGRES_PASSWORD=stackpulse \
  -p 5432:5432 postgres:16

# 5. Run migrations
npx prisma migrate dev

# 6. Seed technology dictionary
npx prisma db seed

# 7. (Optional) Run a small crawl to get data
CRAWL_BATCH_SIZE=1 npx ts-node src/scripts/crawl.ts

# 8. Start the dev server
npm run dev
```

## package.json Scripts

```json
{
  "devDependencies": {
    "tsx": "^4.19.0"
  },
  "scripts": {
    "seed": "tsx prisma/seed.ts",
    "crawl": "tsx src/scripts/crawl.ts",
    "aggregate": "tsx src/scripts/aggregate.ts",
    "snapshot": "tsx src/scripts/snapshot.ts",
    "trends": "tsx src/scripts/trends.ts",
    "export": "tsx src/scripts/export.ts",
    "validate-exports": "tsx src/scripts/validate-exports.ts",
    "test": "vitest run"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" }
}
```
---

# 22. Success Criteria

MVP is complete when all of the following are verified:

| Criterion | Verification |
|-----------|-------------|
| 150+ technologies tracked | `SELECT COUNT(*) FROM "Technology"` ≥ 150 |
| 5,000+ repositories analyzed | `SELECT COUNT(*) FROM "Repository"` ≥ 10,000 |
| Search functional | /api/search?q=react returns results in < 100ms p95 |
| Technology pages functional | /technology/react loads with pairings and top repos |
| Pairings precomputed | `SELECT COUNT(*) FROM "TechnologyPairing"` > 0 |
| Trends precomputed | TrendingSnapshot rows exist for today's UTC date |
| Daily exports generated | public/datasets/*.json committed with correct schema |
| Daily pipeline succeeds | GitHub Actions workflow green on first unassisted run |
| Crawl recovery verified | Re-running crawl after interruption resumes from cursor |
| Local setup under 15 minutes | Timed from `git clone` to `npm run dev` serving the homepage |

# 23. Known Issues and Resolved Bugs

See [CHANGELOG.md](CHANGELOG.md) for the history of resolved bugs.

# 24. System Components

## RepositoryTechnology.lastDetectedAt
The `RepositoryTechnology` table tracks the relationship between repositories and technologies. The `lastDetectedAt` column implements a 30-day rolling adoption window. Technology links are updated on every crawl/refresh to the current timestamp. Queries for adoption metrics (e.g., `repoCount`) and trending data only include links detected within the last 30 days.

## refresh.ts
This is a maintenance component separate from the crawler's discovery-oriented crawl loop.
- **Purpose**: Periodically updates technology links for existing repositories in the sample, ensuring data remains fresh even if a repository isn't discovered again by the crawler.
- **Error Handling Policy**: 
  - **Parse Failures**: If `package.json` cannot be parsed, the script logs a warning and skips only the affected repository.
  - **Missing/Inaccessible Objects (404s)**: If a repository's `package.json` is missing or the object cannot be resolved, the repository is deleted from the database and any affected technology counts are recomputed.
  - **Systemic Failures**: Any other error (e.g., DB connection errors) is treated as a fatal failure, logging the systemic error and halting the entire pipeline (exit 1).
- **Batch Prioritization**: It identifies repos for refresh by ordering them with `COALESCE(MIN(rt."lastDetectedAt"), r."lastCrawledAt") ASC`. This ensures that repositories with the oldest activity or last crawl are refreshed first.
- **Batch Sizing**: The system fetches `Math.ceil(totalRepos / 30)` repositories, effectively scheduling a full refresh of the repository sample over a 30-day cycle.

## monitor_stale.ts
A non-blocking integrity check executed manually or as the final step in the pipeline, following the `validate-exports` step. It queries the `RepositoryTechnology` table for any records where `lastDetectedAt < (NOW() - 30 days)`. It serves as a canary to detect drift in the refresh cycle, alerting if repositories have fallen out of the rolling 30-day adoption window. Failure of this step does not halt the pipeline.



