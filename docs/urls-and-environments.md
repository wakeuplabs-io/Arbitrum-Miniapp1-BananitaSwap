# URLs and environments

## Local development

- UI: `http://localhost:5173`
- API: `http://localhost:3000`

## Remote environments

- Development URL: `TODO_ADD_DEVELOPMENT_URL`
- Production URL: `TODO_ADD_PRODUCTION_URL`

Replace both placeholders before final release.

## Domain topology

When using SST deploy:

- UI domain: `https://<DOMAIN_URL>`
- API domain: `https://api.<DOMAIN_URL>`

Configured in `sst.config.ts`.

## CORS behavior

- Production stage: restrictive origins list based on configured domains.
- Non-production stages: wildcard CORS is enabled for easier testing.
