import assert from 'node:assert/strict';
const base = process.argv[2];
assert.ok(base, 'Usage: node scripts/smoke-api.mjs https://your-api-domain');
for (const [path, status] of [['health', 'ok'], ['ready', 'ready']]) {
  const response = await fetch(new URL(`/api/v1/${path}`, base), { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, `${path} must return 200`);
  const body = await response.json();
  assert.equal(body.data.status, status);
  assert.equal(body.meta.requestId, response.headers.get('x-request-id'));
  assert.equal(response.headers.has('x-powered-by'), false);
  console.log(`${path}: passed`);
}
const denied = await fetch(new URL('/api/v1/courses', base), { signal: AbortSignal.timeout(10000) });
assert.equal(denied.status, 401, 'Unauthenticated course access must be denied');
console.log('Unauthenticated access: denied as expected');
