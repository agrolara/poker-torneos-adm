# Project: Estructuras y Simulador de Premios Explorer

## Architecture
The application is a Vite-based React single page application using Supabase for database storage and user authentication.
- `src/views/Landing.tsx`: Public entry point. Currently shows standard features, super admin access, and league access.
- `src/supabaseClient.ts`: Supabase client configuration.
- `supabase/schema.sql`: Database schema definition including `blind_structures` table.

We will implement the public structures explorer directly in `src/views/Landing.tsx` as a responsive modal, loaded asynchronously from the `blind_structures` table.

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | E2E Testing Track | Set up test infrastructure (Vitest/testing-library) and implement opaque-box test cases for Tiers 1-4. Publish `TEST_READY.md`. | None | DONE |
| M2 | Database Policy & RLS | Verify and update database RLS policies to allow unauthenticated (public) select on `blind_structures`. | None | DONE (Conv: 5eaff998-822b-4060-a889-c02a6b915fc4) |
| M3 | Public Explorer UI | Add a button and responsive modal in `Landing.tsx` to load and display list of blind structures asynchronously. | M2 | DONE (Conv: 5eaff998-822b-4060-a889-c02a6b915fc4) |
| M4 | Levels & Breaks Display | Render levels and breaks for the selected structure, highlighting breaks in green. | M3 | DONE (Conv: 5eaff998-822b-4060-a889-c02a6b915fc4) |
| M5 | Payout Simulator | Add an interactive payout simulator calculating Gross Pool, Rake, Net Pool, and exact prize distributions in real-time. | M4 | DONE (Conv: 5eaff998-822b-4060-a889-c02a6b915fc4) |
| M6 | E2E Test Verification | Ensure 100% of E2E tests pass, then run white-box adversarial coverage checks (Tier 5) and resolve any gaps. | M1, M5 | DONE |
| M7 | Phase 2 Test Track | Implement opaque-box test cases for the advanced dashboard features (KPIs, podios, expanded leaderboard trends) in a new test file. | None | DONE |
| M8 | Dashboard Enhancements | Implement advanced KPIs, completed tournament mini-podios, and expanded leaderboard with chronological trend calculations. | M7 | DONE |
| M9 | Phase 2 Verification & Audit | Run all tests, perform challenger verification, and execute the forensic audit check to verify solution integrity. | M8 | DONE |
| M10 | E2E Timer Sync Tests | Set up and write E2E test cases for timer synchronization, play/pause updates, F5 page refresh, level progression, and background tab resilience. | None | PLANNED |
| M11 | Database RPC Setup | Implement `get_server_time()` Postgres RPC function in `supabase/schema.sql` to provide high-precision server time. | None | PLANNED |
| M12 | Declarative Timer Sync | Implement declarative timer state, transitions-only database updates, and absolute server-time offset calculations. | M11 | PLANNED |
| M13 | Level & Break Progression | Implement automatic level/break progression when remaining seconds reach 0, updating the DB and broadcasting to all clients. | M12 | PLANNED |
| M14 | Verification & Stress Testing | Run peer reviews, verification of timer ticks, F5 refresh persistence, tab-background throttling, and challenger checks. | M10, M13 | PLANNED |
| M15 | Forensic Audit Verification | Execute the Forensic Auditor checks to guarantee sync implementation integrity and zero cheat detection. | M14 | PLANNED |

## Interface Contracts
### Client ↔ Supabase (Database & Realtime)
- **Table `tournaments` columns for timer**:
  - `status`: `'draft' | 'running' | 'paused' | 'completed'`
  - `seconds_remaining`: integer (static seconds left at the last transition)
  - `is_timer_running`: boolean (active running status)
  - `timer_reference_at`: timestamp with time zone (precise server time of the last transition)
  - `current_level_index`: integer (index of the active blind level)
- **Postgres RPC `get_server_time()`**:
  - Returns `timestamp with time zone` (precise server current time, microsecond resolution).
- **Supabase Broadcast Channel `timer_sync`**:
  - Event: `STATE_CHANGE`
  - Payload: `{ seconds_remaining, is_timer_running, current_level_index, timer_reference_at }` (for immediate sub-second notification on transitions).

## Code Layout
- `src/views/Landing.tsx`: Landing page.
- `src/views/Dashboard.tsx`: Main dashboard.
- `src/views/TournamentControl.tsx`: Organizer's Master Console (writes to DB and broadcasts state changes, doesn't listen to its own updates to update clock).
- `src/views/TVDisplay.tsx`: Passive TV display (listens to DB updates/broadcasts and displays calculated remaining time dynamically).
- `supabase/schema.sql`: Contains the database schema and `get_server_time()` RPC function.
- `src/__tests__/`: Folder containing test files.
- `src/__tests__/TimerSync.test.tsx`: E2E/Integration tests for the timer synchronization and level progression.

