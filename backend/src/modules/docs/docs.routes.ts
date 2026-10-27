import { Router } from 'express';
import helmet from 'helmet';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Config } from '../../config/env.schema.js';

const require = createRequire(import.meta.url);
const swaggerDirectory = dirname(require.resolve('swagger-ui-dist/package.json'));

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Thriving in Tech LMS API Documentation</title>
  <link rel="stylesheet" href="/api/docs/swagger-ui.css">
  <script defer src="/api/docs/swagger-ui-bundle.js"></script>
  <script defer src="/api/docs/swagger-initializer.js"></script>
</head>
<body>
  <div id="swagger-ui"></div>
</body>
</html>`;

const initializer = `window.onload = function () {
  window.ui = SwaggerUIBundle({
    url: '/api/docs/openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    displayRequestDuration: true,
    withCredentials: true,
    persistAuthorization: false,
    validatorUrl: null,
    queryConfigEnabled: false,
    presets: [SwaggerUIBundle.presets.apis],
    layout: 'BaseLayout'
  });
};`;

export function docsRoutes(config: Config) {
  const router = Router();
  // This path is identical relative to src/modules/docs and dist/modules/docs.
  const openapi = JSON.parse(
    readFileSync(new URL('../../../docs/openapi.json', import.meta.url), 'utf8'),
  );
  router.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null,
      },
    }),
  );
  router.get('/', (_req, res) => res.type('html').send(html));
  router.get('/openapi.json', (_req, res) => res.json(openapi));
  router.get('/swagger-initializer.js', (_req, res) => res.type('js').send(initializer));
  for (const asset of ['swagger-ui.css', 'swagger-ui-bundle.js']) {
    router.get(`/${asset}`, (_req, res) => res.sendFile(join(swaggerDirectory, asset)));
  }
  return router;
}
