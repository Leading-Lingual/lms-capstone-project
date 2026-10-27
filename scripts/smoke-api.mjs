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

const docs = await fetch(new URL('/api/docs', base), { signal: AbortSignal.timeout(10000) });
assert.equal(docs.status, 200, 'Swagger UI must be available');
assert.match(docs.headers.get('content-type') ?? '', /text\/html/);
assert.match(await docs.text(), /id="swagger-ui"/);
const schema = await fetch(new URL('/api/docs/openapi.json', base), { signal: AbortSignal.timeout(10000) });
assert.equal(schema.status, 200, 'OpenAPI contract must be included in the runtime image');
const contract = await schema.json();
assert.equal(contract.openapi, '3.1.0');
assert.equal(contract.servers[0].url, '/api/v1');
assert.ok(contract.paths['/auth/login']);
for (const asset of ['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-initializer.js']) {
  const response = await fetch(new URL(`/api/docs/${asset}`, base), { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, `Swagger asset ${asset} must be available`);
  await response.body?.cancel();
}
console.log('Swagger UI, bundled assets, and OpenAPI contract: passed');
