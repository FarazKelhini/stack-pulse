import { fileURLToPath } from 'url';
import 'dotenv/config';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { GitHubClient } from '../lib/github';
import { matchTechnologies } from '../lib/matcher';
import { Prisma, TechnologyCategory } from '@prisma/client';
import { performance } from 'perf_hooks';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  logger.error('GITHUB_TOKEN is not set in environment variables');
  process.exit(1);
}

const BATCH_SIZE = Math.min(parseInt(process.env.CRAWL_BATCH_SIZE ?? '100', 10), 100);
const DELAY_MS = parseInt(process.env.CRAWL_DELAY_MS ?? '500', 10);
const MAX_RETRIES = parseInt(process.env.CRAWL_MAX_RETRIES ?? '3', 10);
const MAX_DURATION = parseInt(process.env.CRAWL_MAX_DURATION_MS ?? '5400000', 10);
// A matching batch can perform several dependent writes per repository. Prisma
// defaults interactive transactions to five seconds, which is too short for a
// full GitHub page on a hosted database.
const TRANSACTION_TIMEOUT_MS = parseInt(process.env.CRAWL_TRANSACTION_TIMEOUT_MS ?? '60000', 10);
const TRANSACTION_MAX_WAIT_MS = parseInt(process.env.CRAWL_TRANSACTION_MAX_WAIT_MS ?? '10000', 10);

const COLORS = {
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function cliLog(message: string, level: 'info' | 'error' | 'success' = 'info', currentProgress?: {
  slotLabel: string;
  slotIdx: number;
  totalSlots: number;
  processed: number;
  matched: number;
  errors: number;
  currentRepo: string;
  lastError: string | null;
}) {
  if (!process.stdout.isTTY) {
    console.log(`[${level.toUpperCase()}] ${message}`);
    return;
  }

  // 1. Clear the 2-line progress block before printing the log
  // Move to start of line, clear, move down, clear.
  process.stdout.write('\r\x1b[K\n\x1b[K');

  // 2. Print the beautiful message
  const color = level === 'success' ? COLORS.green : level === 'error' ? COLORS.red : COLORS.blue;
  const label = level === 'success' ? 'SUCCESS' : level === 'error' ? 'ERROR' : 'INFO';
  console.log(`${COLORS.bold}${color}[${label}]${COLORS.reset} ${message}`);

  // 3. Restore the progress bar if data was provided
  if (currentProgress) {
    printProgress(
      currentProgress.slotLabel,
      currentProgress.slotIdx,
      currentProgress.totalSlots,
      currentProgress.processed,
      currentProgress.matched,
      currentProgress.errors,
      currentProgress.currentRepo,
      currentProgress.lastError,
    );
  }
}

function printProgress(
  slotLabel: string,
  slotIdx: number,
  totalSlots: number,
  processed: number,
  matched: number,
  errors: number,
  currentRepo: string = '...',
  lastError: string | null = null,
) {
  if (!process.stdout.isTTY) return;

  // 1. Build Progress Bar
  const barWidth = 20;
  const progress = slotIdx / totalSlots;
  const filledWidth = Math.round(progress * barWidth);
  const bar = `${COLORS.green}${'█'.repeat(filledWidth)}${COLORS.reset}${COLORS.dim}${'░'.repeat(barWidth - filledWidth)}${COLORS.reset}`;
  const percent = Math.round(progress * 100);

  // 2. Line 1: Overall Progress
  const line1 = `${COLORS.yellow}'[CRAWL]'${COLORS.reset} ${bar} ${percent}% | ` +
    `Processed: ${COLORS.bold}${processed.toLocaleString()}${COLORS.reset} | ` +
    `Matched: ${COLORS.green}${matched.toLocaleString()}${COLORS.reset} | ` +
    `Errors: ${COLORS.red}${errors.toLocaleString()}${COLORS.reset} | ` +
    `${COLORS.yellow}${slotLabel}${COLORS.reset}`;

  // 3. Line 2: Current Activity & Last Error
  const repoPart = `${COLORS.dim}Current:${COLORS.reset} ${currentRepo}`;
  const errorPart = lastError
    ? `${COLORS.red}[!] Last Error: ${lastError}${COLORS.reset}`
    : `${COLORS.green}[OK] Healthy${COLORS.reset}`;

  const line2 = `  ${repoPart} ${' '.repeat(Math.max(0, 50 - currentRepo.length))} ${errorPart}`;

  // Write the block. We use \r to return to start, then write two lines.
  // \x1b[K clears the line.
  process.stdout.write(`\r\x1b[K${line1}\n\x1b[K${line2}`);

  // Move cursor back up 1 line so the next update doesn't just keep scrolling
  // but updates the existing block.
  process.stdout.write('\x1b[1A');
}

const WINDOWS = [
  { range: 'stars:>100000', label: 'Window 1' },
  { range: 'stars:10001..100000', label: 'Window 2' },
  { range: 'stars:1001..10000', label: 'Window 3' },
  { range: 'stars:101..1000', label: 'Window 4' },
  { range: 'stars:11..100', label: 'Window 5' },
];

// GitHub's repository search (unlike code search) doesn't support the OR
// operator or parenthetical grouping, so `(language:JavaScript OR
// language:TypeScript)` can't be expressed as a single qualifier. Instead we
// expand each star window into one crawl "slot" per language and page through
// them independently.
const LANGUAGES = ['JavaScript', 'TypeScript'];

interface CrawlSlot {
  range: string;
  language: string;
  label: string;
}

const SLOTS: CrawlSlot[] = WINDOWS.flatMap((window) =>
  LANGUAGES.map((language) => ({
    range: window.range,
    language,
    label: `${window.label} (${language})`,
  })),
);

type CrawlStateCursorMap = Record<string, string | null>;

// Shape of the fields we actually use from GitHub's repository search GraphQL
// response. Kept intentionally narrow rather than typing the full schema.
interface RepoSearchNode {
  databaseId: number;
  nameWithOwner: string;
  url: string;
  stargazerCount: number;
  pushedAt: string | null;
  isDisabled: boolean;
  isEmpty: boolean;
  defaultBranchRef?: { name: string } | null;
  object?: { oid: string; text?: string } | null;
}

interface RepoSearchResult {
  search: {
    nodes: RepoSearchNode[];
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
  };
}

async function getOrCreateCrawlState() {
  const state = await prisma.crawlState.findUnique({ where: { id: 1 } });
  if (!state) {
    return await prisma.crawlState.create({
      data: { id: 1, activeWindow: 1, cursors: {} as CrawlStateCursorMap },
    });
  }
  return state;
}

async function updateCrawlState(activeWindow: number, cursors: CrawlStateCursorMap) {
  await prisma.crawlState.upsert({
    where: { id: 1 },
    update: { activeWindow, cursors },
    create: { id: 1, activeWindow, cursors },
  });
}

// Wraps the GitHub search call with retry + exponential backoff so a single
// transient error (rate limit, network blip, abuse-detection) doesn't fail
// the whole crawl job. Cursors are already persisted per-slot, so retrying
// here (rather than letting the error bubble straight to the outer catch)
// keeps a flaky page from wiping out an otherwise-successful run.
async function discoverWithRetry(
  github: GitHubClient,
  query: string,
  batchSize: number,
  cursor?: string,
): Promise<RepoSearchResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await github.discoverRepositories(query, batchSize, cursor);
    } catch (err) {
      lastErr = err;
      logger.error(
        { err, attempt, maxRetries: MAX_RETRIES, query },
        'GitHub search failed, retrying',
      );
      if (attempt < MAX_RETRIES) {
        const backoffMs = 2 ** attempt * 1000;
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }
  throw lastErr;
}

// Diffs and applies a repository's technology relations given already-resolved
// technology ids for its matched slugs and its already-known existing relation
// ids. Both are precomputed by the caller in a single batched query per batch
// (rather than per repository) to avoid N+1 queries.
export async function processRepository(
  tx: Prisma.TransactionClient,
  node: RepoSearchNode,
  techIds: string[],
  existingTechIds: Set<string>,
) {
  const githubId = BigInt(node.databaseId);
  const pkgSha = node.object?.oid ?? '0';

  const repo = await tx.repository.upsert({
    where: { githubId },
    update: {
      fullName: node.nameWithOwner,
      url: node.url,
      stars: node.stargazerCount,
      lastPushedAt: node.pushedAt ? new Date(node.pushedAt) : null,
      lastCrawledAt: new Date(),
      packageJsonSha: pkgSha,
      defaultBranch: node.defaultBranchRef?.name ?? 'main',
    },
    create: {
      githubId,
      fullName: node.nameWithOwner,
      url: node.url,
      stars: node.stargazerCount,
      lastPushedAt: node.pushedAt ? new Date(node.pushedAt) : null,
      lastCrawledAt: new Date(),
      packageJsonSha: pkgSha,
      defaultBranch: node.defaultBranchRef?.name ?? 'main',
    },
  });

  const newTechIds = new Set(techIds);
  const toRemove = [...existingTechIds].filter((id) => !newTechIds.has(id));
  const toAdd = [...newTechIds].filter((id) => !existingTechIds.has(id));
  const affectedTechIds = new Set([...techIds, ...toRemove]);

  if (toRemove.length > 0) {
    await tx.repositoryTechnology.deleteMany({
      where: {
        repositoryId: repo.id,
        technologyId: { in: toRemove },
      },
    });
  }

  if (toAdd.length > 0) {
    await tx.repositoryTechnology.createMany({
      data: toAdd.map((id) => ({
        repositoryId: repo.id,
        technologyId: id,
        lastDetectedAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  // Always update lastDetectedAt for existing tech-repo links
  await tx.repositoryTechnology.updateMany({
    where: {
      repositoryId: repo.id,
      technologyId: { in: [...newTechIds] },
    },
    data: {
      lastDetectedAt: new Date(),
    },
  });

  return { repoId: repo.id, affectedTechIds: Array.from(affectedTechIds) };
}

export async function recomputeRepoCounts(techIds: string[]) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  await prisma.$executeRaw`
    UPDATE "Technology" t
    SET "repoCount" = (
      SELECT COUNT(*) FROM "RepositoryTechnology" rt
      WHERE rt."technologyId" = t.id AND rt."lastDetectedAt" > ${thirtyDaysAgo}
    )
    WHERE t.id IN (${Prisma.join(techIds)})
  `;
}

async function runCrawl() {
  const github = new GitHubClient(GITHUB_TOKEN as string);
  const jobId = (await prisma.crawlJob.create({
    data: { status: 'queued' },
  })).id;

  await prisma.crawlJob.update({
    where: { id: jobId },
    data: { status: 'running', startedAt: new Date() },
  });

  cliLog('Starting crawl job', 'info');

  let totalProcessed = 0;
  let totalMatched = 0;
  let totalErrors = 0;
  let lastError: string | null = null;
  let lastUpdate = 0;

  let shouldExit = false;
  process.on('SIGINT', () => {
    shouldExit = true;
    logger.info('Received SIGINT, exiting gracefully...');
  });

  const startTime = performance.now();

  try {
    const state = await getOrCreateCrawlState();
    let activeSlotIdx = state.activeWindow - 1;
    let cursors = (state.cursors as unknown as CrawlStateCursorMap) || {};

    while (performance.now() - startTime < MAX_DURATION && !shouldExit) {
      const slot = SLOTS[activeSlotIdx];
      if (!slot) break;
      const cursor = cursors[activeSlotIdx.toString()] || undefined;
      const searchQuery = `${slot.range} language:${slot.language} fork:false archived:false is:public`;

      cliLog(`Starting batch for ${slot.label}...`, 'info', {
        slotLabel: slot.label,
        slotIdx: activeSlotIdx,
        totalSlots: SLOTS.length,
        processed: totalProcessed,
        matched: totalMatched,
        errors: totalErrors,
        currentRepo: '...',
        lastError: lastError,
      });

      const result = await discoverWithRetry(github, searchQuery, BATCH_SIZE, cursor);

      cliLog(`Received batch from GitHub (${result.search.nodes.length} nodes)`, 'info', {
        slotLabel: slot.label,
        slotIdx: activeSlotIdx,
        totalSlots: SLOTS.length,
        processed: totalProcessed,
        matched: totalMatched,
        errors: totalErrors,
        currentRepo: '...',
        lastError: lastError,
      });

      // --- Pagination Check: Advance slot only if hasNextPage is false ---
      if (!result.search.pageInfo.hasNextPage) {
        cliLog(`Slot ${slot.label} exhausted, advancing...`, 'info', {
          slotLabel: slot.label,
          slotIdx: activeSlotIdx,
          totalSlots: SLOTS.length,
          processed: totalProcessed,
          matched: totalMatched,
          errors: totalErrors,
          currentRepo: '...',
          lastError: lastError,
        });
        delete cursors[activeSlotIdx.toString()];
        activeSlotIdx = (activeSlotIdx + 1) % SLOTS.length;
        await updateCrawlState(activeSlotIdx + 1, cursors);
        // Important: jump to next iteration
        continue;
      } else if (result.search.pageInfo.endCursor) {
        cursors[activeSlotIdx.toString()] = result.search.pageInfo.endCursor;
        await updateCrawlState(activeSlotIdx + 1, cursors);
      } else {
        // Fallback
        delete cursors[activeSlotIdx.toString()];
        activeSlotIdx = (activeSlotIdx + 1) % SLOTS.length;
        await updateCrawlState(activeSlotIdx + 1, cursors);
        continue;
      }

      let batchProcessed = 0;
      let batchMatched = 0;
      let batchErrors = 0;
      const affectedTechIds = new Set<string>();

      // --- Batch pre-fetch phase: avoids N+1 queries during per-node processing ---

      // Nodes we can actually attempt to process (skip disabled/empty/no package.json).
      const candidateNodes = result.search.nodes.filter(
        (node) => !node.isDisabled && !node.isEmpty && node.object && node.object.text,
      );
      batchProcessed = result.search.nodes.length;

      const candidateGithubIds = candidateNodes.map((node) => BigInt(node.databaseId));

      const existingRepos = candidateGithubIds.length
        ? await prisma.repository.findMany({
            where: { githubId: { in: candidateGithubIds } },
          })
        : [];
      const existingRepoByGithubId = new Map(
        existingRepos.map((r) => [r.githubId.toString(), r]),
      );

      // Nodes whose package.json actually changed (or repo is new) and therefore
      // need matching + relation diffing. Nodes with an unchanged SHA are handled
      // via a cheap metadata-only update below.
      const nodesToMatch: { node: RepoSearchNode; pkg: any; matchedSlugs: string[] }[] = [];
      const unchangedNodes: RepoSearchNode[] = [];

      for (const node of candidateNodes) {
        const githubId = BigInt(node.databaseId);
        const pkgSha = node.object?.oid ?? '0';
        const existing = existingRepoByGithubId.get(githubId.toString());

        if (existing && existing.packageJsonSha === pkgSha) {
          unchangedNodes.push(node);
          continue;
        }

        try {
          const rawText = node.object!.text as string;
          // Remove UTF-8 Byte Order Mark (BOM) if present
          const cleanText = rawText.replace(/^﻿/, '');
          const pkg = JSON.parse(cleanText);
          const matchedSlugs = await matchTechnologies(pkg);
          nodesToMatch.push({ node, pkg, matchedSlugs });
        } catch (err) {
          batchErrors++;
          totalErrors++;

          const isSyntaxError = err instanceof SyntaxError;
          lastError = isSyntaxError
            ? `Invalid JSON in ${node.nameWithOwner}`
            : (err instanceof Error ? err.message : String(err));

          // For SyntaxErrors, we only log the message to avoid flooding the logs with stack traces
          logger.error(
            {
              err: isSyntaxError ? { message: err.message, type: 'SyntaxError' } : err,
              repo: node.nameWithOwner
            },
            'Failed to parse/match package.json'
          );
        }
      }

      // Cheap metadata-only updates for unchanged repos — single batched query.
      if (unchangedNodes.length > 0) {
        await prisma.$transaction(
          unchangedNodes.map((node) =>
            prisma.repository.update({
              where: { githubId: BigInt(node.databaseId) },
              data: {
                stars: node.stargazerCount,
                lastPushedAt: node.pushedAt ? new Date(node.pushedAt) : null,
                lastCrawledAt: new Date(),
                technologies: {
                  updateMany: {
                    where: {}, // Update all associated tech links
                    data: { lastDetectedAt: new Date() },
                  },
                },
              },
            }),
          ),
        );
      }

      if (nodesToMatch.length > 0) {
        // Resolve all matched slugs across the whole batch in one query.
        const allSlugs = Array.from(
          new Set(nodesToMatch.flatMap(({ matchedSlugs }) => matchedSlugs)),
        );
        const techs = allSlugs.length
          ? await prisma.technology.findMany({
              where: { slug: { in: allSlugs } },
              select: { id: true, slug: true },
            })
          : [];
        const techIdBySlug = new Map(techs.map((t) => [t.slug, t.id]));

        // Preload existing relations for repos that already exist (new repos
        // have none, so no query needed for them).
        const existingRepoIds = nodesToMatch
          .map(({ node }) => existingRepoByGithubId.get(BigInt(node.databaseId).toString())?.id)
          .filter((id): id is string => Boolean(id));

        const existingRels = existingRepoIds.length
          ? await prisma.repositoryTechnology.findMany({
              where: { repositoryId: { in: existingRepoIds } },
            })
          : [];
        const existingTechIdsByRepoId = new Map<string, Set<string>>();
        for (const rel of existingRels) {
          if (!existingTechIdsByRepoId.has(rel.repositoryId)) {
            existingTechIdsByRepoId.set(rel.repositoryId, new Set());
          }
          existingTechIdsByRepoId.get(rel.repositoryId)!.add(rel.technologyId);
        }

        // Keep every transaction to one repository. A full GitHub page can
        // require hundreds of dependent writes, which can outlive Prisma's
        // interactive-transaction timeout on hosted databases. Per-repository
        // transactions remain atomic while allowing the rest of the page to
        // continue if one repository fails.
        for (let i = 0; i < nodesToMatch.length; i++) {
          const item = nodesToMatch[i];
          if (!item) continue;
          const { node, matchedSlugs } = item;

          const now = Date.now();
          if (now - lastUpdate > 100) {
            printProgress(
              slot.label,
              activeSlotIdx,
              SLOTS.length,
              totalProcessed + i,
              totalMatched,
              totalErrors,
              node.nameWithOwner,
              lastError,
            );
            lastUpdate = now;
          }

          const techIds = matchedSlugs
            .map((slug: string) => techIdBySlug.get(slug))
            .filter((id: string | undefined): id is string => Boolean(id));
          const existingRepo = existingRepoByGithubId.get(BigInt(node.databaseId).toString());
          const existingTechIds = existingRepo
            ? existingTechIdsByRepoId.get(existingRepo.id) ?? new Set<string>()
            : new Set<string>();

          try {
            const { affectedTechIds: ids } = await prisma.$transaction(
              (tx) => processRepository(tx, node, techIds, existingTechIds),
              {
                maxWait: TRANSACTION_MAX_WAIT_MS,
                timeout: TRANSACTION_TIMEOUT_MS,
              },
            );
            ids.forEach((id) => affectedTechIds.add(id));
            if (matchedSlugs.length > 0) batchMatched++;
          } catch (err) {
            batchErrors++;
            totalErrors++;
            lastError = err instanceof Error ? err.message : String(err);
            logger.error({ err, window: slot.label, repo: node.nameWithOwner }, 'Failed to process repository');
            cliLog(`Failed to process ${node.nameWithOwner}`, 'error', {
              slotLabel: slot.label,
              slotIdx: activeSlotIdx,
              totalSlots: SLOTS.length,
              processed: totalProcessed + i,
              matched: totalMatched,
              errors: totalErrors,
              currentRepo: node.nameWithOwner,
              lastError,
            });
          }
        }
      }

      // After batch
      totalProcessed += batchProcessed;
      totalMatched += batchMatched;

      if (affectedTechIds.size > 0) {
        await recomputeRepoCounts(Array.from(affectedTechIds));
      }

      await prisma.crawlJob.update({
        where: { id: jobId },
        data: {
          repositoriesProcessed: { increment: batchProcessed },
          repositoriesMatched: { increment: batchMatched },
          errors: { increment: batchErrors },
        },
      });

      printProgress(slot.label, activeSlotIdx, SLOTS.length, totalProcessed, totalMatched, totalErrors, '...', lastError);

      if (DELAY_MS > 0) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    // Clean exit
    await prisma.crawlJob.update({
      where: { id: jobId },
      data: { status: 'completed', completedAt: new Date() },
    });

    const durationSeconds = Math.round((performance.now() - startTime) / 1000);

    if (process.stdout.isTTY) {
      process.stdout.write('\n'); // Move to next line after the progress bar
      console.log(`\n${COLORS.bold}${COLORS.green}Crawl Completed Successfully!${COLORS.reset}`);
      console.log(`--------------------------------------------------`);
      console.log(`Total Processed: ${COLORS.bold}${totalProcessed.toLocaleString()}${COLORS.reset}`);
      console.log(`Total Matched:   ${COLORS.bold}${totalMatched.toLocaleString()}${COLORS.reset}`);
      console.log(`Total Errors:    ${COLORS.red}${totalErrors.toLocaleString()}${COLORS.reset}`);
      console.log(`Duration:        ${COLORS.bold}${durationSeconds}s${COLORS.reset}`);
      console.log(`--------------------------------------------------\n`);
    }

    logger.info({
      service: 'crawl',
      operation: 'crawl_complete',
      status: 'success',
      jobId,
      totalProcessed,
      totalMatched,
      totalErrors,
      durationMs: Math.round(performance.now() - startTime),
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ err, jobId, error: errorMessage }, 'Crawl job failed');
    await prisma.crawlJob.update({
      where: { id: jobId },
      data: { status: 'failed', completedAt: new Date() },
    });
    throw err;
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  runCrawl().catch((err) => {
    logger.error({ err }, 'Unhandled error in runCrawl');
    process.exit(1);
  });
}
