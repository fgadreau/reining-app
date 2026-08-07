# Deployment Environments

Use separate Supabase projects for development/staging and production. The app
can be deployed more than once from the same codebase, but each deployment must
receive the right environment variables.

Production is frozen while the shared HSP block/class rebuild is being made
data-safe. Do not run ShowScore SQL directly against the shared production
project. HorseShowPlatform owns the canonical migration chain.

## Recommended Setup

| Environment | App URL | Supabase project | Purpose |
| --- | --- | --- | --- |
| Local dev | `http://localhost:3001` | Supabase DEV | Daily development and testing |
| Online preproduction | stable `preprod` URL | Supabase PREPROD | Real-device testing before production |
| Production | production URL | Supabase PROD | Real show data only |

Keep test shows and training data out of Supabase PROD.

## Supabase Projects

ShowScore currently targets the shared HorseShowPlatform Supabase schema. The
HorseShowPlatform migration history is the authoritative source for shared
database changes.

For each shared project:

1. Run the HorseShowPlatform migrations.
2. Enable email/password auth in Supabase Auth.
3. Add your platform admin with [platform-admin-bootstrap.sql](platform-admin-bootstrap.sql).
4. Add the app URLs to the Auth redirect/site URL settings when email links or confirmations are enabled.

The platform admin command must be run once per Supabase project, after the Auth
user exists in that project.

## Shared Supabase With HorseShowPlatform

When the same Supabase project serves both `showscore.app` and
`horseshowplatform.app`, HorseShowPlatform owns the canonical base tables:
`organizations`, `shows`, `show_days`, and `classes`.

For that shared project:

1. Run the HorseShowPlatform migrations first.
2. Add your platform admin with [platform-admin-bootstrap.sql](platform-admin-bootstrap.sql).

Do not run files from
[archive/standalone-supabase](archive/standalone-supabase) on the shared
HorseShowPlatform project. They are historical standalone ShowScore artifacts
and may create older base tables such as `associations`, `days`, and generic
scoring tables.

## Environment Variables

Local development:

1. Copy `.env.development.example` to `.env.local`.
2. Fill it with Supabase DEV values.
3. Run `npm start`.

Online preproduction:

Set these variables in the hosting dashboard:

```text
VITE_DEPLOY_ENV=staging
VITE_SUPABASE_URL=<Supabase DEV URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<Supabase DEV publishable key>
VITE_SUPABASE_PROJECT_REF=<Supabase DEV project ref>
VITE_PRODUCTION_SUPABASE_PROJECT_REF=<Supabase PROD project ref>
```

Production:

Set these variables in the hosting dashboard:

```text
VITE_DEPLOY_ENV=production
VITE_SUPABASE_URL=<Supabase PROD URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<Supabase PROD publishable key>
VITE_SUPABASE_PROJECT_REF=<Supabase PROD project ref>
VITE_PRODUCTION_SUPABASE_PROJECT_REF=<Supabase PROD project ref>
```

Do not reuse the DEV Supabase URL in production.

The Vite build rejects a Preview/Production deployment without an explicit
environment, a URL/project-ref mismatch, staging connected to PROD, or
production connected to DEV. Non-production builds also show a persistent
banner on private, public, TV and OBS pages.

## Hosting Notes

The app is a Vite single-page app.

Build command:

```bash
npm run build
```

Publish/output directory:

```text
build
```

Node version:

```text
20+
```

The repo includes:

- [vercel.json](../vercel.json) for Vercel SPA rewrites.
- [public/_redirects](../public/_redirects) for Netlify SPA rewrites.

Either Vercel or Netlify can host the app. The important part is the environment
variables, not the hosting provider.

## Branch Workflow

Recommended:

| Branch | Deployment | Supabase |
| --- | --- | --- |
| `preprod` | Online preproduction | PREPROD |
| `main` | Production | PROD |

Typical release flow:

1. Work locally against Supabase DEV.
2. Open a pull request and merge to `preprod`.
3. Test the stable preproduction deployment with real devices and the cross-app robot.
4. Merge to `main`.
5. Confirm the production deployment uses Supabase PROD variables.

The controlled cross-app order and rollback procedure are documented in
[production-promotion.md](production-promotion.md).

## Pre-Production Checklist

Before using production for a real show:

1. Run the latest schema in Supabase PROD.
2. Add the platform admin in Supabase PROD.
3. Confirm Auth email/password is enabled.
4. Confirm the production deployment has PROD Supabase variables.
5. Create one production association.
6. Invite one secretary and one scribe.
7. Create a small test show, sign a class, validate it, and publish results.
8. Delete the test show if it was only for validation.
