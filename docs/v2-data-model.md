# V2 Data Model And Roadmap

## Objective

Make the app usable in a real show with secretariat, live scoring, web publication, stronger official PDFs, better CSV imports, clear roles, and the first cloud sync path.

V2 should stay focused on one real show workflow before expanding to V3 multi-judge scoring.

## Guiding Principles

- Keep one clear source of truth for each concept.
- Move business rules into feature services/repositories, not pages.
- Keep the UI working while storage moves from local-only to cloud-ready.
- Build read-only public/announcer views from published state, not from draft scoring state.
- Treat official results and PDFs as immutable once validated.

## Core Entities

### Association

Represents the organization running shows.

Fields:
- `id`
- `name`
- `shortName`
- `timezone`
- `logoDataUrl`

### Show

Represents an event.

Fields:
- `id`
- `associationId`
- `name`
- `venue`
- `location`
- `startDate`
- `endDate`
- `status`

Suggested statuses:
- `draft`
- `active`
- `completed`
- `archived`

### Day

Represents one show day.

Fields:
- `id`
- `associationId`
- `showId`
- `label`
- `date`
- `sortOrder`

### Class

Represents the base class record.

Fields:
- `id`
- `associationId`
- `showId`
- `dayId`
- `name`
- `classCode`
- `pattern`
- `judgeName`
- `sortOrder`

Class should not own scoring state directly.

### Class Setup

Represents pre-scoring setup.

Fields:
- `classId`
- `pattern`
- `runs`
- `isDrawImported`
- `startedAt` actual scoring start, captured from the first score or penalty entry
- `dragInterval`
- `dragDurationMinutes`
- `lockedAt`
- `lockedBy`

Each setup run:
- `id`
- `order`
- `backNumber`
- `rider`
- `horse`
- `owner`

### Scoring Session

Represents scoring in progress.

Fields:
- `classId`
- `runs`
- `activeManoeuvre`
- `startedAt`
- `updatedAt`

Each scoring run:
- `id`
- `draw`
- `backNumber`
- `rider`
- `horse`
- `owner`
- `scores`
- `penalties`
- `penTotal`
- `scoreTotal`
- `isActive`
- `startedAt`
- `completedAt`
- `durationSeconds`

### Official Result

Represents the final signed result for a class.

Fields:
- `classId`
- `judgeName`
- `judgeSignature`
- `finalized`
- `finalizedAt`
- `judgeSignedAt`
- `secretariatValidatedAt`
- `finalPdfFileName`
- `officialRuns`

V2 can support one judge. V3 extends this entity for multiple judges.

### Publication State

Represents what can be shown outside the scoring desk.

Fields:
- `classId`
- `status`
- `publishedAt`
- `publishedBy`
- `publicUrl`
- `visibleFields`

Suggested statuses:
- `hidden`
- `live`
- `pending_review`
- `official`
- `published`

### User

Represents an operator account.

Fields:
- `id`
- `displayName`
- `email`

Roles are not stored directly on the user. They are assigned through association memberships.
The app stores a lightweight `UserProfile` row after login so admins can assign association access by email.

### Association Membership

Connects a user to one association with one role.

Fields:
- `id`
- `userId`
- `associationId`
- `role`
- `createdAt`
- `updatedAt`

Rules:
- one user can be attached to one or more associations
- one user can have more than one role for the same association if needed
- secretary permissions are scoped to the attached association
- local-only mode treats the current operator as unrestricted until cloud roles are enabled

### Role

V2 roles:
- `admin`
- `secretary`
- `scribe`
- `announcer`
- `public`

V3 roles:
- `judge`
- `headSecretary`
- `auditor`

## Role Responsibilities

### Scribe

Can:
- enter scores and penalties
- change active run/manoeuvre
- submit class for signature
- edit manual draw once scoring started

Cannot:
- publish public results
- validate official results
- edit imported draw once scoring started

### Secretary

Scope:
- attached to one or more associations
- secretary actions apply only inside those associations

Can:
- create shows, days, classes
- import CSV/draw
- review class readiness
- validate official result
- generate or regenerate official PDF
- publish/unpublish results

### Announcer

Can view:
- current class
- current run
- next runs
- latest score if allowed by publication state

Cannot edit.

### Public

Can view:
- published official results
- live-safe data only when publication state explicitly allows it

No draft scoring data should leak to public views unless explicitly published.

Public access does not use the internal app menu and should not expose back-office routes.

### Admin

Scope:
- attached to one or more associations
- in V2, this is the association owner/operator role

Can manage:
- association settings
- users
- show configuration
- all secretary actions

## Main Workflows

### 1. Class Setup

1. Secretary creates class.
2. Secretary selects pattern.
3. Secretary imports or enters draw.
4. App validates missing back numbers/riders/horses.
5. Secretary marks setup as ready.

Output:
- stable `Class`
- stable `ClassSetup`
- class status becomes `ready`

### 2. Live Scoring

1. Scribe opens a ready class.
2. App creates or loads `ScoringSession`.
3. Scribe enters scores and penalties.
4. App saves each update.
5. Announcer dashboard reads safe live state.
6. Public view reads only publishable state.

Output:
- `ScoringSession`
- class status becomes `in_progress`

### 3. Finalization

1. App verifies all runs are complete.
2. Judge signs.
3. App creates `OfficialResult`.
4. Secretary reviews.
5. Secretary validates official result.
6. App generates official PDF.

Output:
- immutable official result
- class status becomes `official`

### 4. Publication

1. Secretary chooses what to publish.
2. App updates `PublicationState`.
3. Public page reads only published state.
4. Announcer page reads live-safe state.

Output:
- public class page
- live dashboard feed

## Status Model

Class status:
- `draft`: missing setup data
- `ready`: setup complete, scoring not started
- `in_progress`: scoring has started
- `pending_signature`: scoring complete, waiting for judge signature
- `pending_review`: signed, waiting for secretariat validation
- `official`: validated by secretariat
- `published`: official and visible publicly

Show status:
- `draft`
- `active`
- `completed`
- `archived`

Publication status:
- `hidden`
- `live`
- `official`
- `published`

## Repository Layer Target

The next implementation step should be a repository layer that hides storage details.

Suggested modules:

```txt
src/features/shows/showRepository.js
src/features/classes/classRepository.js
src/features/scoring/scoringRepository.js
src/features/publication/publicationRepository.js
```

Initial APIs:

```js
getShowFullData(showId)
getClassFullData(classId)
saveClassSetup(classId, setup)
startScoringSession(classId)
saveRunScore(classId, runId, updates)
finalizeClass(classId, officialData)
validateOfficialResult(classId, secretaryId)
publishClass(classId, options)
unpublishClass(classId)
```

For now, repositories can use localStorage. Later they can switch to Supabase/Firebase without rewriting pages.

## Cloud Sync Recommendation

Preferred direction: Supabase.

Reasons:
- show/class/run data is relational
- roles and permissions matter
- official results need auditability
- exports and reporting will matter later

Firebase remains a valid option if live synchronization speed is the dominant priority, but Supabase fits the official-results direction better.

## V2 Implementation Order

1. Create repository layer over current localStorage.
2. Add `PublicationState` locally.
3. Improve CSV import with validation report.
4. Add Secretary dashboard.
5. Add Announcer dashboard.
6. Add Public read-only page.
7. Improve official PDF lifecycle.
8. Introduce Supabase schema behind repositories.
9. Add basic authentication and roles.
10. Move live reads/writes to cloud-backed repositories.

## V3 Preparation

Do not implement multi-judge scoring in V2, but avoid naming that assumes one judge forever.

Use names like:
- `officialResult`
- `judgeResults`
- `scoringPanel`

Avoid names like:
- `theJudgeScore`
- `singleJudgeResult`

V3 will add:
- 2, 3, or 5 judges
- score aggregation
- drop highest / drop lowest for 5 judges
- multi-judge official PDF
- final validation by secretariat
- cloud history and audit log
- real user accounts and permissions
