# Production promotion

ShowScore is promoted by merging `preprod` into `main`. No feature branch may
be merged directly into production.

HorseShowPlatform owns the canonical migrations for the shared Supabase
project. Its production-readiness rehearsal, database dry-run, migration and
deployment must finish before the ShowScore production PR is merged.

## Required order

1. Keep both HSP and ShowScore promotion PRs in draft.
2. Run the HSP **Production readiness rehearsal** against the current preprod
   deployments; it includes the cross-app mega robot.
3. Rehearse and approve the HSP migrations on a private copy of production.
4. Back up PROD, apply the approved migrations and deploy HSP `main`.
5. Confirm the HSP production smoke test is green.
6. Mark the ShowScore `preprod → main` PR ready and merge it.
7. Confirm Vercel, authentication, schedule, live management, TV general, main
   arena and OBS in read-only production checks.

If the HSP or ShowScore preprod SHA changes after the rehearsal, repeat the
rehearsal before either production merge.
