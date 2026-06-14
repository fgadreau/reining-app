# HSP / ShowScore Results Integration Status

**Date:** 2026-06-14

## Current Direction

HSP is the source of truth for show administration, entries, classes/divisions, payouts, and official administrative results.
ShowScore is the scoring/live surface. It receives a self-contained draw from HSP, can work offline/local-first during the show, and returns finalized run scores back to HSP in batch when a scoring block is officially validated.

## Model Decisions

- A competitor can physically pass once and have that score apply to multiple entries/classes.
- HSP must send a self-contained draw payload to ShowScore:
  - `run_id`
  - `block_run_id`
  - back number, rider, horse, owner
  - order of go
  - `entry_ids[]`
  - division/class metadata needed for ShowScore live standings
- If HSP has concurrent blocks, ShowScore should see them as one scoring session/block when they represent the same physical scoring run.
- ShowScore should not do official HSP fan-out logic.
- HSP receives final scores and fans them out to `entry_results`.
- Scores are pushed to HSP in batch only after the block is validated/finalized in ShowScore.
- Future payout data comes back from HSP to ShowScore as part of final results, not scoresheets.

## Completed

### ShowScore

- Fixed PDF draw import worker error.
- Added provisional class standings based on existing results logic.
- Added accordions for order of go, provisional standings/classes, and announcer "past scored runs".
- Added HSP draw conversion path that feeds the existing ShowScore run/class result structures.
- Preserved HSP metadata on runs:
  - `runId`
  - `blockRunId`
  - `entryIds`
  - `divisionIds`
- Added concurrent class/block grouping helpers so HSP concurrent blocks can resolve to one ShowScore scoring unit.
- Added batch sync from ShowScore official validation to HSP `scored_runs`.

### HSP

- Added migration `0063_showscore_scored_runs_results.sql`.
- New tables:
  - `scored_runs`
  - `block_run_entries`
  - `block_run_class_entries`
  - `entry_results`
- Added triggers so `scored_runs` fan out into `entry_results`.
- Added HSP types for scored runs and entry results.
- Updated ShowScore preparation to save run/link metadata for HSP.
- Added Dashboard show context filtering for operational views:
  - classes
  - entries
  - stalls/reservations
  - scoring
  - billing
  - personal entries/stalls/invoices

## Verified

- ShowScore tests passed: `91/91`.
- ShowScore build passed.
- HSP build passed after scoring-result and show-context changes.
- `git diff --check` passed on both apps during the last verification passes.

## Next Logical Steps

1. Add an HSP results view/tab that reads `entry_results`, filtered by current show, grouped by division.
2. Make sure the HSP results view can show:
   - final score
   - scratch
   - no score
   - disqualified
3. Add a clear admin flow for reviewing/recalculating class/division results after ShowScore sync.
4. Later: add HSP -> ShowScore final results snapshot for the public results view, including payouts when ready.

## Important Later Items

- Year-end awards are not part of this phase.
- Payouts should appear in ShowScore results, not in scoresheets.
- `association_memberships -> organization_members` cleanup is intentionally postponed.
