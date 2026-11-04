# Local frontend origins against the hosted API

Date: 2026-11-04. Status: accepted by product owner. Supporting FR01 frontend integration.

Allow the explicitly configured HTTP origins `http://localhost:3000`, `http://localhost:5173`, and `http://localhost:8081` when the API runs in production mode. The team needs these development frontend addresses to call the hosted API. Deployed frontend addresses continue to require HTTPS. The runtime CORS and write-origin checks still use exact configured origins, with no wildcard or implicit localhost access.

Keep FRONTEND_URL as a single frontend URL for recovery email links. FRONTEND_ORIGINS accepts a comma-separated list and can include both the local addresses and the deployed HTTPS frontend when ready. Invalid lists must return validation issues rather than throw during configuration parsing.

This supersedes the blanket HTTPS-only frontend configuration in Decision 0002, while preserving the Secure, HttpOnly, SameSite Lax session policy. Authenticated cross-site browser testing requires a same-origin development proxy or a local API; adding CORS origins does not change cookie delivery. No database migration or new environment variable is required.
