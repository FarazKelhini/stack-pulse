# StackPulse Changelog

All notable changes to the StackPulse system are documented here.

## [Unreleased] - 2026-07-31

### Bug Fixes

1. **Silent Tech Wipe**: `refresh.ts` silently wiped repository technologies on `package.json` parse failure. Fixed to skip the repository instead.
2. **Production Guard Failure**: `refresh.ts` and `crawl.ts` executed their main logic on import. Fixed by guarding with `if (isMain)` where `isMain` is derived from `import.meta.url`.
3. **Missing Discovery**: GitHubClient was missing `discoverRepositories`, breaking scheduled crawls.
4. **Crawl Stall**: Slot exhaustion logic incorrectly relied on empty node array instead of `hasNextPage`.
5. **Null Object Crash**: `processRepository` crashed on `node.object === null` (missing `package.json`). Fixed to clear technology links instead of crashing.
6. **Stale repoCount**: `processRepository` excluded removed technologies from `affectedTechIds`, causing `repoCount` drift. Fixed to include `toRemove` in the recompute set.
7. **Inaccurate recompute**: The logic for recomputing `repoCount` was stale for any technology removal. Fixed and verified via a global recompute pass.
