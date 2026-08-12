import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubClient, fetchWithBackoff } from '../lib/github';

describe('GitHubClient', () => {
  const token = 'fake-token';
  let client: GitHubClient;

  beforeEach(() => {
    client = new GitHubClient(token);
    vi.restoreAllMocks();
  });

  it('returns null without retrying when repo is not found via GraphQL error message', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          errors: [
            {
              message: "Could not resolve to a Repository with the name 'shibit-net/xuanji'.",
              type: 'NOT_FOUND',
            },
          ],
        }),
      };
    });

    const repo = await client.getRepository('shibit-net/xuanji');
    expect(repo).toBeNull();
    // Should NOT retry 3 times with backoff, should return null on attempt 0
    expect(callCount).toBe(1);
  });

  it('returns null without retrying when repo returns HTTP 404', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: false,
        status: 404,
        json: async () => ({ errors: [{ message: 'Not Found' }] }),
      };
    });

    const repo = await client.getRepository('nonexistent/repo');
    expect(repo).toBeNull();
    expect(callCount).toBe(1);
  });

  it('returns repository object when GitHub returns valid repository data', async () => {
    const mockRepo = {
      databaseId: 100,
      nameWithOwner: 'owner/repo',
      url: 'https://github.com/owner/repo',
      stargazerCount: 42,
      isDisabled: false,
      isEmpty: false,
      defaultBranchRef: { name: 'main' },
      pushedAt: '2026-01-01T00:00:00Z',
      object: { oid: 'sha', text: '{"dependencies":{}}' },
    };

    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        data: {
          repository: mockRepo,
        },
      }),
    }));

    const repo = await client.getRepository('owner/repo');
    expect(repo).toEqual(mockRepo);
  });
});
