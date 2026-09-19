import { createApp } from './app';
import { connectDatabase } from './db/connect';
import { env, isCogneeConfigured, isGeminiConfigured, isN8nConfigured } from './config/env';

async function main() {
  await connectDatabase();
  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      [
        `[resolveai] listening on :${env.port}`,
        `  AI MODE:      ${isGeminiConfigured() ? 'GEMINI' : 'DEMO FALLBACK'}`,
        `  MEMORY:       ${isCogneeConfigured() ? 'COGNEE' : 'LOCAL FALLBACK'}`,
        `  WORKFLOWS:    ${isN8nConfigured() ? 'N8N CLOUD' : 'LOCAL FALLBACK'}`,
      ].join('\n')
    );
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[resolveai] failed to start', error);
  process.exit(1);
});
