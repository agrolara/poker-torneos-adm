# Implementation Plan — Timer Sync and Level Progression

We are implementing a high-precision, transitions-only timer synchronization system for the poker tournament administration application.

## Tasks

### 1. Database RPC Setup
- Update `supabase/schema.sql` to add:
  ```sql
  create or replace function public.get_server_time()
  returns timestamp with time zone
  language sql
  stable
  as $$
    select clock_timestamp();
  $$;
  ```

### 2. High-precision Clock Offset Sync and Fast Interval Loop
- Create a shared hook or helper function for clock synchronization, or implement it directly in both `TournamentControl.tsx` and `TVDisplay.tsx`.
- The synchronization logic:
  - Record local send time: `const start = Date.now();`
  - Call `supabase.rpc('get_server_time')`.
  - Record local receive time: `const end = Date.now();`
  - Calculate RTT: `const rtt = end - start;`
  - Calculate clock offset: `const offset = new Date(serverTimeStr).getTime() + (rtt / 2) - end;`
  - Update `clockOffsetRef.current = offset;`
- Periodically (e.g., every 30 seconds or 1 minute) recalculate the offset to prevent drift.
- Use a fast interval loop (e.g., every 100ms or 250ms) to derive the current remaining time and update the display state:
  - If timer is running:
    - Current server time: `const nowServer = Date.now() + clockOffsetRef.current;`
    - Elapsed time since reference: `const elapsedMs = nowServer - new Date(dbTimerReferenceAt).getTime();`
    - Derived remaining seconds: `const remainingSecs = Math.max(0, dbSecondsRemaining - Math.floor(elapsedMs / 1000));`
    - If remaining seconds reaches 0: trigger automatic progression (for Organizer only).
  - If timer is not running:
    - Display remaining seconds: `dbSecondsRemaining`.

### 3. Transitions-Only Writes in TournamentControl.tsx
- Remove any interval/second-by-second database writes.
- Write to the database ONLY when a transition event occurs:
  - Play / Resume
  - Pause
  - Next Level (Manual or Auto)
  - Previous Level
  - Manual time adjustment (e.g. edit timer)
- When writing, fetch server time using `get_server_time` to use as `timer_reference_at` to avoid client clock bias in the DB.
- Simultaneously broadcast the state update over the Supabase broadcast channel `timer_sync` with event `STATE_CHANGE` and payload containing:
  - `seconds_remaining`
  - `is_timer_running`
  - `timer_reference_at`
  - `current_level_index`
  - And all other standard UI state fields (blind amounts, ante, average stack, etc.).

### 4. TVDisplay Passive Sync
- TVDisplay must NEVER write to the database.
- It should listen for:
  - Supabase Realtime broadcast channel `timer_sync`, event `STATE_CHANGE`
  - Supabase database replication changes on `tournaments`
- When an update is received, it updates its base reference states (`dbSecondsRemaining`, `dbIsRunning`, `dbTimerReferenceAt`, etc.) and recalculates the offset if needed.
- It derives the remaining seconds using the fast interval loop.

### 5. Automatic Level Progression
- In `TournamentControl.tsx` (Organizer), when the fast interval loop derives `remainingSecs === 0` and the timer is running:
  - Automatically transition to the next level/break.
  - Write the updated level state and server time `timer_reference_at` to the DB and broadcast.
  - Keep a lock or guard to ensure the transition is triggered exactly once.

## Verification
- Vitest E2E tests: Run `npm run test` (when E2E testing track finishes writing tests).
- Role Separation Check: Inspect database calls to ensure TVDisplay does not perform any database writes (insert/update/delete) or RPCs other than `get_server_time`.
