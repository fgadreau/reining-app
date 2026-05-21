# Reining App

Local-first reining show management and scoring app.

## Current State

V1 is a local React app for:
- association/show/day/class setup
- draw setup
- scribe scoring
- judge signature/finalization
- official PDF generation

## V2 Direction

The next version targets real show usage with secretariat/live workflows:
- dashboard live
- web publication
- stronger official PDF lifecycle
- stronger CSV import
- clear roles: scribe, secretary, announcer, public
- first cloud sync path

See [docs/v2-data-model.md](docs/v2-data-model.md).

## Supabase

Supabase is optional for local-only testing, but it is required for multi-user
cloud workflows.

Cloud-ready repositories currently cover:
- associations, shows, days, classes
- class setup/draws
- scoring sessions
- publication state

If Supabase is not configured, or if permissions reject a request, the app falls back to local browser storage.

1. Create a Supabase project.
2. Run [docs/supabase-schema.sql](docs/supabase-schema.sql) in the SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Set `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_PUBLISHABLE_KEY`.
5. Restart `npm start`.
6. In Supabase Auth, enable email/password sign-ins.
7. Open `/login` in the app and create or sign into a user before using secretary/scribe cloud writes.
8. Add a platform admin when needed by running
   [docs/platform-admin-bootstrap.sql](docs/platform-admin-bootstrap.sql) with
   your email.
9. Attach users to an association from `/associations/:associationId/access`,
   or bootstrap a first admin membership in the Supabase SQL editor:

```sql
insert into public.association_memberships (user_id, association_id, role)
select id, 'association-id-here', 'secretary'
from auth.users
where email = 'secretariat@example.com';
```

Once an admin membership exists, the app menu exposes `/associations/:associationId/access` for basic role assignment.
Users can then be added to association roles by email from that page.

If the user already signed in once, the role is added immediately. If the user does not exist yet, the app creates a pending invitation and gives the admin a link to copy or send by email. The invited user creates an account from that link, then the app accepts the invitation after login.

## Deployment

Use separate Supabase projects for development/staging and production. See
[docs/deployment.md](docs/deployment.md).

Environment examples:

- `.env.development.example` for local development against Supabase DEV.
- `.env.staging.example` for an online staging deployment against Supabase DEV.
- `.env.production.example` for production against Supabase PROD.

The app includes SPA routing config for Vercel (`vercel.json`) and Netlify
(`public/_redirects`).

## Scripts

Recommended runtime:

```bash
nvm install
nvm use
node -v
```

The project targets Node 20+.

```bash
npm start
npm test -- --watchAll=false
npm run build
```
