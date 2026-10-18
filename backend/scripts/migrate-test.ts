import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const url = process.env.TEST_DIRECT_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('TEST_DIRECT_URL must target a database ending in _test.');
const runtime = process.env.TEST_DATABASE_URL;
if (
  !runtime ||
  new URL(runtime).pathname !== new URL(url).pathname ||
  new URL(runtime).host !== new URL(url).host
) {
  throw new Error('Test runtime and migration URLs must point at the same isolated database.');
}
const require = createRequire(import.meta.url);
const result = spawnSync(
  process.execPath,
  [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
  {
    stdio: 'inherit',
    env: { ...process.env, DIRECT_URL: url },
  },
);
process.exit(result.status ?? 1);
