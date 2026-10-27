import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const template = await readFile(new URL('../backend/.env.example', import.meta.url), 'utf8');
const owner = randomBytes(24).toString('hex');
const app = randomBytes(24).toString('hex');
const content = template
  .replaceAll('local_owner_password', owner)
  .replaceAll('local_app_password', app)
  .replace('replace_with_64_hex_characters', randomBytes(32).toString('hex'));
try {
  await writeFile(new URL('../backend/.env', import.meta.url), content, { flag: 'wx', mode: 0o600 });
  console.log('Created backend/.env with generated local secrets. Existing database credentials are never overwritten.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('backend/.env already exists; kept existing settings.');
}
