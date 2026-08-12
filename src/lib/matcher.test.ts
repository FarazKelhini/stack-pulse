import { describe, it, expect, vi, beforeEach } from 'vitest';

// A small fixture dictionary standing in for data/technologies.json.
// Note two different npm package names ("react-dom" and "preact") intentionally
// map to the same slug so we can exercise deduplication.
const FIXTURE_DICTIONARY = [
  { npmPackage: 'react', slug: 'react' },
  { npmPackage: 'react-dom', slug: 'react-family' },
  { npmPackage: 'preact', slug: 'react-family' },
  { npmPackage: 'vitest', slug: 'vitest' },
  { npmPackage: 'zod', slug: 'zod' },
];

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(() => Promise.resolve(JSON.stringify(FIXTURE_DICTIONARY))),
  },
}));

import fs from 'fs/promises';
import { matchDependencies } from './matcher';

describe('matchDependencies', () => {
  beforeEach(() => {
    vi.mocked(fs.readFile).mockClear();
  });

  it('matches technologies from dependencies', async () => {
    const slugs = await matchDependencies({
      dependencies: { react: '^18.0.0' },
    });
    expect(slugs).toEqual(['react']);
  });

  it('matches technologies from devDependencies', async () => {
    const slugs = await matchDependencies({
      devDependencies: { vitest: '^1.0.0' },
    });
    expect(slugs).toEqual(['vitest']);
  });

  it('matches technologies from peerDependencies', async () => {
    const slugs = await matchDependencies({
      peerDependencies: { zod: '^3.0.0' },
    });
    expect(slugs).toEqual(['zod']);
  });

  it('matches across all three fields at once', async () => {
    const slugs = await matchDependencies({
      dependencies: { react: '^18.0.0' },
      devDependencies: { vitest: '^1.0.0' },
      peerDependencies: { zod: '^3.0.0' },
    });
    expect(slugs.sort()).toEqual(['react', 'vitest', 'zod'].sort());
  });

  it('deduplicates when two different npm packages map to the same slug', async () => {
    const slugs = await matchDependencies({
      dependencies: { 'react-dom': '^18.0.0' },
      devDependencies: { preact: '^10.0.0' },
    });
    // react-dom and preact both map to "react-family" — should only appear once
    expect(slugs).toEqual(['react-family']);
  });

  it('ignores unknown packages not present in the dictionary', async () => {
    const slugs = await matchDependencies({
      dependencies: { 'some-unlisted-package': '^1.0.0', react: '^18.0.0' },
    });
    expect(slugs).toEqual(['react']);
  });

  it('returns an empty array when no dependency fields are present', async () => {
    const slugs = await matchDependencies({});
    expect(slugs).toEqual([]);
  });

  it('returns an empty array when no dependencies match anything in the dictionary', async () => {
    const slugs = await matchDependencies({
      dependencies: { 'totally-unknown': '^1.0.0' },
    });
    expect(slugs).toEqual([]);
  });

  it('loads the dictionary from disk only once across multiple calls (caching)', async () => {
    // Isolate this test with a fresh module instance, since matcher.ts caches
    // the dictionary at module scope for the lifetime of the process.
    vi.resetModules();
    const fsFresh = (await import('fs/promises')).default;
    vi.mocked(fsFresh.readFile).mockClear();
    const { matchDependencies: freshMatch } = await import('./matcher');

    await freshMatch({ dependencies: { react: '^18.0.0' } });
    await freshMatch({ devDependencies: { vitest: '^1.0.0' } });

    expect(fsFresh.readFile).toHaveBeenCalledTimes(1);
  });
});
