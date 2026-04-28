# URLs and environments

## Local development

- UI: `http://localhost:5173`
- API: `http://localhost:3000`

## Remote environments

Deployed UI and API URLs are **not fixed in this repo**; they are determined by your `DOMAIN_URL` and SST outputs when you run deploy (see `sst.config.ts`). Document your staging and production URLs in your own deployment notes or fork after setup.

## Domain topology

When using SST deploy:

- UI domain: `https://<DOMAIN_URL>`
- API domain: `https://api.<DOMAIN_URL>`

Configured in `sst.config.ts`.

## CORS behavior

- Production stage: restrictive origins list based on configured domains.
- Non-production stages: wildcard CORS is enabled for easier testing.
