import prisma from '../src/lib/prisma';
async function check() {
  const repo = await prisma.repository.findUnique({ 
    where: { fullName: 'gitkraken/vscode-gitlens' },
    include: { technologies: { include: { technology: true } } }
  });
  console.log('Repo:', repo ? repo.fullName : 'Not found');
  console.log('Tech links:', repo ? repo.technologies.map(t => t.technology.slug) : 'None');
}
check();
