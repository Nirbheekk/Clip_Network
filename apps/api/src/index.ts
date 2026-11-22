import { PrismaClient } from '@prisma/client';
import { buildServer } from './server.js';
import { startBackgroundMonitorScheduler } from './integrations/scheduler.js';

const prisma = new PrismaClient();
const app = buildServer(prisma);

const port = Number(process.env['PORT'] ?? 4100);
const host = process.env['HOST'] ?? '0.0.0.0';

app
  .listen({ port, host })
  .then(() => {
    console.log(`@clip-network/api listening on http://${host}:${port}`);
    startBackgroundMonitorScheduler(prisma, async (workspaceId) => {
      await prisma.creatorAccount.updateMany({
        where: { workspaceId, autoMonitorEnabled: true },
        data: { lastPolledAt: new Date() },
      });
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
