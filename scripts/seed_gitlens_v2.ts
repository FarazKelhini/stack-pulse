import { GitHubClient } from '../src/lib/github';
import prisma from '../src/lib/prisma';
import { processRepository } from '../src/scripts/crawl';
import { matchTechnologies } from '../src/lib/matcher';

async function seed() {
  const github = new GitHubClient(process.env.GITHUB_TOKEN!);
  const repo = await github.getRepository('gitkraken/vscode-gitlens');
  if (!repo) { console.error('Could not fetch gitlens'); return; }

  // The 'node.object.text' is indeed JSON, but the raw output was dumping the *entire* parsed object
  // Let's just use the repo object returned directly.
  const pkg = JSON.parse(repo.object!.text!);
  const slugs = matchTechnologies(pkg);
  const techs = await prisma.technology.findMany({ where: { slug: { in: slugs } } });

  // Use a unique ID to be absolutely sure we aren't hitting collisions
  const result = await prisma.$transaction(async (tx) => {
    return await processRepository(tx, repo as any, techs.map(t => t.id), new Set());
  });
  console.log('Seeded gitlens. Repo ID:', result.repoId);
}
seed().catch(err => {
    console.error(err);
    process.exit(1);
});
