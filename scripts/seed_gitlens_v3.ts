import { GitHubClient } from '../src/lib/github';
import prisma from '../src/lib/prisma';
import { processRepository } from '../src/scripts/crawl';
import { matchTechnologies } from '../src/lib/matcher';

async function seed() {
  const github = new GitHubClient(process.env.GITHUB_TOKEN!);
  const repo = await github.getRepository('gitkraken/vscode-gitlens');
  if (!repo) { console.error('Could not fetch gitlens'); return; }

  // Use a simpler, hardcoded set of tech IDs for the test to avoid JSON parsing issues
  const tech = await prisma.technology.findFirst({ where: { slug: 'typescript' } });
  const techIds = tech ? [tech.id] : [];

  const result = await prisma.$transaction(async (tx) => {
    return await processRepository(tx, repo as any, techIds, new Set());
  });
  console.log('Seeded gitlens. Repo ID:', result.repoId);
}
seed().catch(err => {
    console.error(err);
    process.exit(1);
});
