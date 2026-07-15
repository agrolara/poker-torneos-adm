# Scope: Tournament Timer Sync and Level Progression Implementation

## Architecture
We will transition the codebase from a chatty, drift-prone timer implementation (per-second writes to Supabase, local interval-based countdowns) to a high-precision, event-driven, absolute-time synchronization mechanism.
- **Data Source of Truth**: The Supabase `tournaments` table contains the timer state: `status`, `seconds_remaining`, `is_timer_running`, `timer_reference_at`, and `current_level_index`.
- **Clock Sync Protocol**:
  1. Clients call the database RPC `get_server_time()` on mount and periodically.
  2. By comparing client request send time, server response, and client receive time, the client calculates the network round-trip time (RTT) and absolute clock offset relative to the server: `Offset = ((ServerTime - ClientSendTime) + (ServerTime - ClientRecvTime)) / 2`.
  3. The local client-side elapsed time since `timer_reference_at` is derived using the synchronized server time: `CurrentServerTime = LocalNow + Offset`.
  4. If the timer is running, `RemainingSeconds = Max(0, seconds_remaining - Floor(CurrentServerTime - timer_reference_at))`.
  5. If the timer is paused, `RemainingSeconds = seconds_remaining`.
- **Event-Driven Write Separation**:
  - **TournamentControl (Organizer)**: Writes to the database ONLY when a transition occurs: play, pause, level change, manual time edit. When writing, it updates `seconds_remaining`, `is_timer_running`, `timer_reference_at` (server timestamp), and `current_level_index` in the database, and simultaneously broadcasts the new state payload over a Supabase Realtime Broadcast channel (`timer_sync`) for sub-second synchronization.
  - **TVDisplay / passive clients**: NEVER write to the database. They subscribe to the broadcast channel and standard Supabase database replication changes to dynamically re-sync their internal derived clock states.
- **Level/Break progression**: When `RemainingSeconds` reaches 0, the active organizer client transitions to the next level/break, writes the new state to the DB, and broadcasts it.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database RPC | Implement `get_server_time()` Postgres RPC function in `supabase/schema.sql`. | None | PLANNED |
| M2 | Clock Offset Sync & Loop | Create helper functions/hook for RTT-compensated clock offset calculation. | M1 | PLANNED |
| M3 | TVDisplay Passive Sync | Refactor `TVDisplay.tsx` to listen to realtime state changes and derive remaining time locally without writes. | M2 | PLANNED |
| M4 | TournamentControl Transitions | Refactor `TournamentControl.tsx` to perform transitions-only writes to DB, broadcast state changes, and use the server offset loop. | M3 | PLANNED |
| M5 | Level & Break Transitions | Implement clean automatic transitions to next levels/breaks at 0s. | M4 | PLANNED |
| M6 | Role Separation Audit | Verify that the Organizer writes to DB on transitions only, and TV Display never writes to DB. | M5 | PLANNED |
| M7 | Phase 1 E2E Verification | Ensure all Tier 1-4 tests created by the testing track pass. | M6 | PLANNED |
| M8 | Phase 2 Adversarial Hardening | Generate Tier 5 adversarial tests, check coverage gaps, and fix any exposed bugs. | M7 | PLANNED |
| M9 | Forensic Audit Verification | Run Forensic Auditor to guarantee implementation integrity and clean verdict. | M8 | PLANNED |

## Interface Contracts
### Supabase Database Schema Updates
- **RPC `get_server_time()`**:
  ```sql
  CREATE OR REPLACE FUNCTION public.get_server_time()
  RETURNS timestamp with time zone
  LANGUAGE sql
  STABLE
  AS $$
    SELECT clock_timestamp();
  $$;
  ```
- **Supabase Realtime Broadcast Channel**:
  - Channel name: `timer_sync`
  - Event name: `STATE_CHANGE`
  - Payload format:
    ```json
    {
      "seconds_remaining": 1200,
      "is_timer_running": true,
      "timer_reference_at": "2026-07-15T03:16:08Z",
      "current_level_index": 0
    }
    ```
