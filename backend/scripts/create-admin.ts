import 'dotenv/config';
import { createDatabase } from '../src/infrastructure/database/client.js';
import { emailSchema, passwordSchema } from '../src/modules/auth/auth.schema.js';
import { hashPassword } from '../src/lib/security.js';

const email = emailSchema.parse(process.env.ADMIN_EMAIL);
const password = passwordSchema.parse(process.env.ADMIN_PASSWORD);
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required.');
const db = createDatabase(url);
try {
  if (await db.user.findUnique({ where: { email } }))
    throw new Error(
      'Account already exists. This command never overwrites an account or grants an existing account administrator access.',
    );
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: 'Program Administrator',
        role: 'ADMIN',
        emailVerifiedAt: new Date(),
        passwordHash: await hashPassword(password),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: null,
        requestId: 'controlled-bootstrap',
        action: 'ADMIN_BOOTSTRAPPED',
        resourceId: user.id,
      },
    });
  });
  console.log('Administrator created. No credentials were printed.');
} finally {
  await db.$disconnect();
}
