# Supabase Inventory Audit

**Date:** 2026-06-12  
**Scope:** `reining-app` (ShowScore) + `horseshowplatform` (HSP)  
**Key finding:** Both apps already point to the **same production Supabase project** (`srzzituovoxkvvlaesxa.supabase.co`) and the same local dev instance. The shared-Supabase migration is complete at the infrastructure level.

---

## 1. ShowScore (`reining-app`)

### 1a. Environment Files

| File | Line | Type | Variable / Value | Old vs New Supabase | Risk | Recommended Action |
|---|---|---|---|---|---|---|
| `.env.local` | 1 | URL | `VITE_SUPABASE_URL=http://127.0.0.1:54321` | Shared local | safe | OK — shared local dev instance |
| `.env.local` | 2 | Key | `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJ…` (masked) | Shared local | safe | OK — same local key as HSP |
| `.env.production` | 1 | URL | `VITE_SUPABASE_URL=https://srzzituovoxkvvlaesxa.supabase.co` | **Shared HSP prod** | safe | Confirmed on shared HSP instance ✓ |
| `.env.production` | 2 | Key | `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_pNw…` (masked) | Shared HSP prod | safe | Same key as HSP `.env.example` ✓ |
| `.env.production` | 3 | Env flag | `VITE_DEPLOY_ENV=production` | — | safe | HSP doesn't define this; not shared |
| `.env.example` | 2 | URL | `VITE_SUPABASE_URL=https://srzzituovoxkvvlaesxa.supabase.co` | Shared HSP | duplicate | Same URL hardcoded in both apps' examples — intentional |
| `.env.example` | 3 | Key | `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_pNw…` (masked) | Shared HSP | duplicate | Same key as HSP `.env.example` |
| `.env.example` | 5 | Key | `VITE_SUPABASE_ANON_KEY=eyJhbGc…` (masked JWT) | Shared HSP | risky | Legacy anon key format; app falls back to it if PUBLISHABLE_KEY absent — should be removed once all envs use PUBLISHABLE_KEY |
| `.env.example` | 7 | Secret | `SUPABASE_SERVICE_ROLE_KEY=` (empty) | — | safe | Server-side; empty placeholder, never in browser |
| `.env.development.example` | — | URL | `VITE_SUPABASE_URL=https://your-dev-project.supabase.co` | Placeholder | safe | Generic example, not used |
| `.env.staging.example` | — | URL | `VITE_SUPABASE_URL=https://your-dev-project.supabase.co` | Placeholder | safe | Generic example, not used |
| `.env.production.example` | — | URL | `VITE_SUPABASE_URL=https://your-prod-project.supabase.co` | Placeholder | safe | Generic example, not used |

### 1b. Source Files — Client Initialization

| File | Line | Type | Variable / Value | Old vs New Supabase | Risk | Recommended Action |
|---|---|---|---|---|---|---|
| `src/features/cloud/supabaseClient.js` | 4 | Env read | `VITE_SUPABASE_URL` | Both | safe | Centralized singleton, correct |
| `src/features/cloud/supabaseClient.js` | 5–10 | Env read | `VITE_SUPABASE_PUBLISHABLE_KEY \|\| VITE_SUPABASE_ANON_KEY` | Both | risky | Legacy `ANON_KEY` fallback still active — two key formats supported; creates ambiguity |
| `src/features/cloud/supabaseClient.js` | 27–40 | `createClient` | Lazy singleton | Both | safe | Returns `null` if unconfigured or in local test mode |

### 1c. Source Files — Table Queries

| File | Line | Type | Table / RPC | Old vs New Supabase | Risk | Recommended Action |
|---|---|---|---|---|---|---|
| `src/features/associations/associationRepository.js` | 75 | write | `organizations` (try first) → `associations` (fallback) | New → Old | safe | Dual-compat pattern, correct |
| `src/features/shows/showRepository.js` | 152 | read | `shows` `.eq("organization_id")` → retry `.eq("association_id")` | New → Old | safe | Dual-compat, correct |
| `src/features/shows/showRepository.js` | 217 | write | `shows` with `organization_id` → fallback `toStandaloneShowRow` | New → Old | safe | Dual-compat, correct |
| `src/features/days/dayRepository.js` | 60–97 | write/delete | `show_days` (try first) → `days` (fallback) | New → Old | safe | Dual-compat pattern, correct |
| `src/features/days/dayRepository.js` | 125,153 | read | `days` (standalone fallback path) | Old | safe | Only reached if `show_days` fails |
| `src/features/classes/classRepository.js` | 235 | write | `classes` with HSP cols → `toStandaloneClassRow` fallback | New → Old | safe | Dual-compat loop, correct |
| `src/features/classes/classRepository.js` | 518–527 | read | `classes` `.eq("show_day_id")` → retry `.eq("day_id")` | New → Old | safe | Dual-compat, correct |
| `src/features/classes/classSetupRepository.js` | 386 | write | `show_score_class_setups` | New | safe | Correct new name |
| `src/features/classes/classSetupRepository.js` | 367–377 | write | `classes` update with `scheduled_time` (no fallback to `schedule_start_time`) | New only | risky | On standalone schema, schedule start time silently not saved; minor regression |
| `src/features/scoring/scoringRepository.js` | — | read/write | `show_score_scoring_sessions` | New | safe | Correct new name |
| `src/features/scoring/judgeScoringSessionRepository.js` | — | read/write | `show_score_judge_sessions` | New | safe | Correct new name |
| `src/features/publication/publicationCloudRepository.js` | 81,119,167,178,433,507,885 | read/write | `show_score_publication_states` | New | safe | All updated correctly |
| `src/features/publication/publicationCloudRepository.js` | 238 | read | `classes` select with `scheduled_time` (new col) | New | safe | Correct |
| `src/features/publication/publicationCloudRepository.js` | 245 | read | `days` (query — goes through compatibility VIEW) | Old name / new view | safe | Works via `days` VIEW on HSP; no change needed |
| `src/features/publication/publicationCloudRepository.js` | 248 | read | `show_score_paid_warmups` | New | safe | Correct |
| `src/features/publication/publicViewRepository.js` | 600 | read | `days` (query — goes through compatibility VIEW) | Old name / new view | safe | Works via `days` VIEW on HSP |
| `src/features/publication/publicViewRepository.js` | 614 | read | `classes` `.eq("show_day_id")` | New | safe | Correct |
| `src/features/publication/publicViewRepository.js` | 619 | read | `show_score_paid_warmups` | New | safe | Correct |
| `src/features/publication/publicViewRepository.js` | 891,929 | read | `associations` (query — goes through compatibility VIEW) | Old name / new view | safe | Works via `associations` VIEW on HSP |
| `src/features/publication/publicViewRepository.js` | 1018 | read | `shows` `.eq("organization_id")` | New | safe | Correct |
| `src/features/paidWarmups/paidWarmupRepository.js` | — | read/write | `show_score_paid_warmups` | New | safe | Correct new name |
| `src/features/auth/accessRepository.js` | 71,99,212,236,242 | read/write | `association_memberships` (goes through compat VIEW) | Old name / new view | safe | HSP 0050 creates `association_memberships` VIEW over `organization_members` ✓ |
| `src/features/auth/invitationRepository.js` | 183–427 | read/write | `association_invitations` | New (native) | safe | Table exists natively in HSP 0053 ✓ |
| `src/features/auth/authRepository.js` | — | write | `user_profiles` with `user_id` (try) → `id` (fallback) | New → Old | safe | Dual-compat, correct |
| `src/features/analytics/analyticsRepository.js` | 218 | read | `app_events` | **Old only** | **risky** | `app_events` table is NOT in any HSP migration — only in standalone schema; reads will fail silently on shared HSP |

### 1d. Source Files — RPC Calls

| File | Line | RPC Name | Defined in HSP? | Risk | Recommended Action |
|---|---|---|---|---|---|
| `src/features/associations/associationRepository.js` | 221 | `create_association_with_owner` | HSP 0050 ✓ | safe | OK |
| `src/features/shows/showRepository.js` | 291 | `activate_show_for_scoring` | HSP 0050 ✓ | safe | OK |
| `src/features/auth/accessRepository.js` | 138,161 | `find_user_profile_for_association` | HSP 0050 ✓ | safe | OK |
| `src/features/auth/invitationRepository.js` | 128,154 | `accept_association_invitation` | HSP 0053 ✓ | safe | OK |
| `src/features/analytics/analyticsRepository.js` | 173 | `record_app_event` | HSP 0051 (stub) ✓ | safe | Stub exists; check if it actually stores data |
| `src/features/classes/classRepository.js` | 453 | `global_pattern_timing_stats` | **NOT in HSP migrations** | **risky** | Only defined in ShowScore SQL docs; ShowScore falls back to client-side computation but function is absent from HSP — add to HSP migration |
| `src/features/publication/publicViewRepository.js` | 840 | `public_show_timing_summary` | **NOT in HSP migrations** | **risky** | Same situation — only in ShowScore SQL docs; add to HSP migration |

### 1e. Realtime Subscriptions

| File | Line | Table | Correct for HSP? | Risk | Recommended Action |
|---|---|---|---|---|---|
| `src/features/live/liveViewRepository.js` | 33–39 | `show_score_scoring_sessions`, `show_score_judge_sessions`, `show_score_class_setups`, `show_score_publication_states`, `show_score_official_results` | ✓ (fixed) | safe | OK — corrected in recent session |
| `src/features/live/liveViewRepository.js` | 153 | `show_days` | ✓ (fixed) | safe | OK |
| `src/features/live/liveViewRepository.js` | 175 | `show_score_paid_warmups` | ✓ (fixed) | safe | OK |
| `src/features/publication/publicViewRepository.js` | 513–566 | `show_days`, `show_score_paid_warmups`, `show_score_publication_states`, `show_score_official_results`, `show_score_scoring_sessions`, `show_score_judge_sessions`, `show_score_class_setups` | ✓ | safe | All correct |

### 1f. Tools & Scripts

| File | Line | Type | Variable | Risk | Recommended Action |
|---|---|---|---|---|---|
| `tools/supabase-public-smoke.mjs` | 149 | Env read | `VITE_SUPABASE_URL \|\| REACT_APP_SUPABASE_URL` | risky | `REACT_APP_SUPABASE_URL` is a dead CRA-era variable — can be removed |
| `tools/supabase-public-smoke.mjs` | 154–158 | Env read | Four key variable fallbacks including `REACT_APP_*` variants | risky | Remove `REACT_APP_*` fallbacks — CRA is gone (migrated to Vite) |
| `package.json` | 23 | Test script | `VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_SUPABASE_ANON_KEY=` (blanked) | safe | Correct — forces offline mode in tests |

---

## 2. HorseShowPlatform (`horseshowplatform`)

### 2a. Environment Files

| File | Line | Type | Variable / Value | Old vs New Supabase | Risk | Recommended Action |
|---|---|---|---|---|---|---|
| `.env.local` | 1 | URL | `VITE_SUPABASE_URL=http://127.0.0.1:54321` | Shared local | safe | Same as ShowScore local ✓ |
| `.env.local` | 2 | Key | `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJ…` (masked) | Shared local | safe | Same local key as ShowScore ✓ |
| `.env.example` | 2 | URL | `VITE_SUPABASE_URL=https://srzzituovoxkvvlaesxa.supabase.co` | **Shared HSP prod** | safe | Same project as ShowScore prod ✓ |
| `.env.example` | 3 | Key | `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_pNw…` (masked) | Shared HSP prod | safe | Same key as ShowScore production ✓ |
| `.env.example` | 5 | Key | `VITE_SUPABASE_ANON_KEY=eyJhbGc…` (masked JWT) | Shared HSP | risky | Same legacy key issue as ShowScore |
| `.env.example` | 7 | Secret | `SUPABASE_SERVICE_ROLE_KEY=` (empty) | — | safe | Placeholder only |

### 2b. Source Files — Client Initialization

| File | Line | Type | Variable / Value | Risk | Recommended Action |
|---|---|---|---|---|---|
| `src/lib/env.ts` | 2 | Env read | `VITE_SUPABASE_URL` | safe | Correct |
| `src/lib/env.ts` | 3 | Env read | `VITE_SUPABASE_PUBLISHABLE_KEY \|\| VITE_SUPABASE_ANON_KEY` | risky | Same dual-key fallback as ShowScore — same legacy issue |
| `src/lib/supabase.ts` | 3–11 | `createClient` | Eager module-level singleton; `null` if unconfigured | safe | Different pattern from ShowScore (eager vs lazy); both functional |
| `src/features/setup/SetupScreen.tsx` | 20 | UI template | `https://your-project.supabase.co` (placeholder string in JSX) | safe | Just a display hint in setup UI, not a real URL |

### 2c. Source Files — RPC Calls

| File | Line | RPC Name | Risk | Recommended Action |
|---|---|---|---|---|
| `src/services/supabaseServices.ts` | 2088 | `claim_horse_back_number` | safe | Native HSP RPC |
| `src/services/supabaseServices.ts` | 3073 | `assert_horse_health_valid_for_show` | safe | Native HSP RPC |
| `src/services/supabaseServices.ts` | 3080 | `assert_horse_coggins_valid_for_show` | safe | Native HSP RPC |
| `src/services/supabaseServices.ts` | 3356 | `claim_contacts_for_current_user` | safe | Native HSP RPC |
| `src/services/supabaseServices.ts` | 3388 | `reuse_contact_by_email` | safe | Native HSP RPC |

### 2d. Storage

| File | Line | Bucket | Operation | Risk | Recommended Action |
|---|---|---|---|---|---|
| `src/services/supabaseServices.ts` | 1537 | `health-documents` | `createSignedUrl` | safe | Native HSP bucket — not shared with ShowScore |
| `src/services/supabaseServices.ts` | 1576 | `health-documents` | `upload` | safe | Native HSP bucket |

### 2e. Migrations

| File | Key Tables / Objects | Impact on ShowScore |
|---|---|---|
| `0050_showscore_compatibility.sql` | Views: `associations`, `days`, `association_memberships`; RPCs: `create_association_with_owner`, `activate_show_for_scoring`, `find_user_profile_for_association` | Covers ShowScore's legacy table queries ✓ |
| `0051_showscore_public_access.sql` | `record_app_event` stub; public RLS policies | Covers ShowScore analytics RPC ✓ |
| `0053_association_invitations.sql` | `association_invitations` table; `accept_association_invitation` RPC | Covers ShowScore invitation flows ✓ |
| `0057_paid_warmup_missing_cols.sql` | `show_score_paid_warmups` column additions | ShowScore paid warmup compat ✓ |

---

## 3. Summary — Conflicts & Inconsistencies

### 3.1 CONFIRMED: Both apps share the same Supabase project

All production and local-dev credentials across both apps map to the same Supabase instance. **The infrastructure migration is complete.** There is no active standalone ShowScore Supabase in prod or local dev.

### 3.2 Missing RPCs on the shared Supabase (high priority)

Two RPC functions used by ShowScore are defined only in ShowScore's SQL docs, not in any HSP migration:

| RPC | Defined in | Status |
|---|---|---|
| `global_pattern_timing_stats` | `docs/supabase-class-timing-migration.sql` + compat SQL | **NOT in HSP migrations** — ShowScore falls back to client-side, but silently |
| `public_show_timing_summary` | `docs/supabase-public-directory-migration.sql` + compat SQL | **NOT in HSP migrations** — same silent fallback |

These functions exist in ShowScore's `docs/supabase-shared-showscore-hsp-compatibility.sql` but that file targets the reining-app Supabase, not HSP. They need to be added as a new HSP migration (e.g., `0058_showscore_timing_functions.sql`).

### 3.3 `app_events` table missing from HSP (medium priority)

ShowScore reads `from("app_events")` for the analytics admin page. This table exists in the standalone schema but has no HSP migration. On the shared HSP Supabase, this query returns an error (caught silently). The analytics history feature is non-functional on HSP.

Options:
- Add an `app_events` table via an HSP migration
- Or replace ShowScore analytics with HSP's native `audit_events` table

### 3.4 Compat SQL split between two files (medium priority)

ShowScore's `docs/supabase-shared-showscore-hsp-compatibility.sql` and HSP's `supabase/migrations/0050_showscore_compatibility.sql` serve overlapping purposes but are not identical:

| View / Object | In SS compat SQL | In HSP 0050 |
|---|---|---|
| `associations` VIEW | ✓ | ✓ |
| `days` VIEW | ✓ | ✓ |
| `association_memberships` VIEW + triggers | ✗ | ✓ |
| `create_association_with_owner` | ✓ | ✓ |
| ShowScore-specific tables (`show_score_*`) | ✓ | ✓ (0057) |

The `docs/supabase-shared-showscore-hsp-compatibility.sql` file is now redundant — HSP's migration history is the authoritative source. Risk of divergence if both are maintained.

### 3.5 Legacy `VITE_SUPABASE_ANON_KEY` still supported (low priority)

Both apps' client code falls back to `VITE_SUPABASE_ANON_KEY` if `VITE_SUPABASE_PUBLISHABLE_KEY` is absent. Both `.env.example` files include the anon key as a "legacy" hint. This creates two key formats in circulation — once all environments are confirmed on `PUBLISHABLE_KEY`, the anon key fallback and its documentation can be removed.

### 3.6 Dead `REACT_APP_*` variable fallbacks in smoke test (low priority)

`tools/supabase-public-smoke.mjs` still reads `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_PUBLISHABLE_KEY` — CRA-era variables that no longer exist since the Vite migration. Safe to remove.

### 3.7 Client initialization pattern mismatch (informational)

| | ShowScore | HSP |
|---|---|---|
| Pattern | Lazy singleton (`getSupabaseClient()` returns `null`) | Eager module-level (`supabase` may be `null`; `requireSupabase()` throws) |
| Offline mode | Returns `null`, local-first fallback | `null` supabase, no local fallback |
| Key fallback | `PUBLISHABLE_KEY \|\| ANON_KEY` | `PUBLISHABLE_KEY \|\| ANON_KEY` |

No immediate conflict, but if a shared auth/client layer is ever extracted, the patterns will need to be reconciled.

---

## 4. Priority Actions

| Priority | Action |
|---|---|
| 🔴 High | Add `global_pattern_timing_stats` and `public_show_timing_summary` as an HSP migration (e.g., `0058_showscore_timing_functions.sql`) |
| 🔴 High | Decide on `app_events`: add HSP migration or redirect to `audit_events` |
| 🟡 Medium | Deprecate `docs/supabase-shared-showscore-hsp-compatibility.sql` — HSP migrations are now authoritative |
| 🟡 Medium | Remove `VITE_SUPABASE_ANON_KEY` from both `.env.example` files once confirmed all envs use `PUBLISHABLE_KEY` |
| 🟢 Low | Remove `REACT_APP_*` fallbacks from `tools/supabase-public-smoke.mjs` |
| 🟢 Low | Add `classSetupRepository.syncClassScheduleStartFields` fallback for `schedule_start_time` (standalone compat, minor) |
