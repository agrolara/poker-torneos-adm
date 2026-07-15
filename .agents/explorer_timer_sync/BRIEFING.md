# BRIEFING — 2026-07-15T03:33:00-04:00

## Mission
Investigate tournament timer mechanisms, database schema, real-time sync, and drift issues, then propose a robust sync strategy.

## 🔒 My Identity
- Archetype: Teamwork explorer
- Roles: Read-only investigator, analyzer
- Working directory: C:\Users\Usuario\Documents\antigravity\Poker torneos adm\.agents\explorer_timer_sync
- Original parent: 2451942c-5270-479b-99d4-b82eae321691
- Milestone: Timer Sync Strategy

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- CODE_ONLY network mode
- Write files to explorer_timer_sync directory only

## Current Parent
- Conversation ID: 2451942c-5270-479b-99d4-b82eae321691
- Updated: 2026-07-15T03:33:00-04:00

## Investigation State
- **Explored paths**: `src/App.tsx`, `src/types.ts`, `src/views/TVDisplay.tsx`, `src/views/TournamentControl.tsx`, `src/views/TournamentSetup.tsx`, `supabase/schema.sql`
- **Key findings**:
  - Organizer console does database updates every second, causing massive writes, real-time replication storm, and feedback loops where the organizer overwrites its own state.
  - Clock offset sync uses HTTP `Date` headers, losing millisecond resolution and causing drift.
  - Background tab throttling halts timer ticking and database updates.
- **Unexplored areas**: None, the core problem is fully diagnosed.

## Key Decisions Made
- Proposed a declarative, state-based synchronization strategy relying on relative elapsed time calculated from an absolute server reference timestamp, completely eliminating high-frequency writes.

## Artifact Index
- C:\Users\Usuario\Documents\antigravity\Poker torneos adm\.agents\explorer_timer_sync\handoff.md — Final investigation report
