import { logger } from './logger';

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

const DISCOVER_REPOS_QUERY = `
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
`;

export interface DiscoverRepositoriesResponse {
  search: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    nodes: Array<
      | {
          databaseId: number;
          nameWithOwner: string;
          url: string;
          stargazerCount: number;
          isDisabled: boolean;
          isEmpty: boolean;
          defaultBranchRef: { name: string } | null;
          pushedAt: string | null;
          object: { oid: string; text: string } | null;
        }
    >;
  };
}

export async function fetchWithBackoff<T>(
  fn: () => Promise<{ data: T; headers: Headers }>,
  retries = parseInt(process.env.CRAWL_MAX_RETRIES ?? '3', 10)
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data } = await fn();
      return data;
    } catch (err: any) {
      if (err.status === 404 || err.isNotFound) {
        throw err;
      }

      if (attempt === retries) {
        logger.error({ err, attempt }, 'GitHub request failed after max retries');
        throw err;
      }

      // GitHub secondary rate limit: HTTP 403 + Retry-After header
      if (err.status === 403 && err.headers?.get('retry-after')) {
        const retryAfterSeconds = Number(err.headers.get('retry-after'));
        const retryAfterMs = retryAfterSeconds * 1000;
        logger.warn({ retryAfterMs, attempt }, 'GitHub secondary rate limit hit, retrying...');
        await new Promise((r) => setTimeout(r, retryAfterMs));
        continue;
      }

      // Transient errors: exponential backoff with jitter
      // Server gateway errors (502/503/504) use a higher initial base delay (2s)
      const isServerError = err.status >= 500 && err.status <= 504;
      const baseDelay = isServerError ? 2000 : 500;
      const backoff = Math.min(baseDelay * 2 ** attempt + Math.random() * 500, 30_000);
      logger.warn({ backoff, attempt, err: err.message }, 'GitHub request failed, retrying with backoff...');
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw new Error('Unreachable');
}

export class GitHubClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async discoverRepositories(
    searchQuery: string,
    batchSize: number,
    cursor?: string
  ): Promise<DiscoverRepositoriesResponse> {
    try {
      const data = await fetchWithBackoff(async () => {
        const response = await fetch(GITHUB_GRAPHQL_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'StackPulse-Crawler/1.0',
          },
          body: JSON.stringify({
            query: DISCOVER_REPOS_QUERY,
            variables: { searchQuery, batchSize, cursor },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const err: any = new Error(
            errorData.errors?.[0]?.message || `GitHub API error: ${response.status}`
          );
          err.status = response.status;
          err.headers = response.headers;
          throw err;
        }
        const result = await response.json();
        if (result.errors) {
          const err: any = new Error(result.errors[0].message);
          throw err;
        }
        return { data: result.data, headers: response.headers };
      });
      return data;
    } catch (err: any) {
      throw err;
    }
  }

  async getRepository(fullName: string) {
    const [owner, name] = fullName.split('/');
    const query = `
      query GetRepository($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
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
    `;

    try {
      const data = await fetchWithBackoff(async () => {
        const response = await fetch(GITHUB_GRAPHQL_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'StackPulse-Crawler/1.0',
          },
          body: JSON.stringify({ query, variables: { owner, name } }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const err: any = new Error(errorData.errors?.[0]?.message || `GitHub API error: ${response.status}`);
          err.status = response.status;
          err.headers = response.headers;
          if (response.status === 404) err.isNotFound = true;
          throw err;
        }
        const result = await response.json();
        if (result.errors) {
          const firstErr = result.errors[0];
          const err: any = new Error(firstErr.message);
          if (
            firstErr.type === 'NOT_FOUND' ||
            firstErr.message?.includes('Could not resolve to a Repository')
          ) {
            err.status = 404;
            err.isNotFound = true;
          }
          throw err;
        }
        return { data: result.data, headers: response.headers };
      });

      return data.repository;
    } catch (err: any) {
      if (err.status === 404 || err.isNotFound || err.message?.includes('Could not resolve to a Repository')) {
        return null;
      }
      throw err;
    }
  }

}
