import 'dotenv/config';
import { envSchema } from './config/env.schema.js';
import { createDatabase } from './infrastructure/database/client.js';
import { createEmailTransport } from './infrastructure/email/transport.js';
import { createEmailDispatcher } from './infrastructure/email/email.service.js';
import { createApp } from './app.js';

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    'Invalid configuration:',
    parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
  );
  process.exit(1);
}
const config = parsed.data;
const db = createDatabase(config.DATABASE_URL);
const app = createApp(db, config);
const server = app.listen(config.PORT, config.HOST, () =>
  console.log(`LMS API listening on ${config.HOST}:${config.PORT}`),
);
const dispatch = createEmailDispatcher(
  db,
  createEmailTransport(config),
  config.MAIL_ENCRYPTION_KEY,
);
let job: Promise<void> | undefined;
const timer = setInterval(() => {
  if (!job)
    job = dispatch()
      .catch(() => console.error('Email dispatcher unavailable; jobs remain queued.'))
      .finally(() => {
        job = undefined;
      });
}, 2000);
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  const deadline = setTimeout(() => process.exit(1), 10000).unref();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await job;
  await db.$disconnect();
  clearTimeout(deadline);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
