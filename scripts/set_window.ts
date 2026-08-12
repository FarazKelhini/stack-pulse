import prisma from '../src/lib/prisma';

async function setWindow(window: number) {
  await prisma.crawlState.update({
    where: { id: 1 },
    data: { activeWindow: window, cursors: {} }
  });
  console.log('Set activeWindow to', window);
}
setWindow(1).catch(console.error);
