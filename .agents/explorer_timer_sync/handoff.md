# Handoff Report: Poker Tournament Timer Sync Investigation

## 1. Observation

During our read-only investigation, the following files and code snippets were identified and analyzed:

### A. Database Schema
In `supabase/schema.sql`, the `tournaments` table contains fields specifically representing the tournament's timing state (lines 84–103):
```sql
create table if not exists public.tournaments (
  id uuid default gen_random_uuid() primary key,
  organizer_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'running', 'paused', 'completed')),
  ...
  current_level_index integer default 0,
  seconds_remaining integer default 0,
  is_timer_running boolean default false,
  timer_reference_at timestamp with time zone default timezone('utc'::text, now()),
  ...
);
```
Line 106 configures Supabase Realtime replication for this table:
```sql
alter publication supabase_realtime add table public.tournaments;
```

### B. High-Frequency Database Writes in the Organizer Console
In `src/views/TournamentControl.tsx`, when `isRunning` is `true`, a local `setInterval` runs every 1000ms. It decrements the local state and updates the database every single second (lines 179–208):
```typescript
  // Sync Timer with local state changes and save to database every second
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            return 0;
          }
          const nextSec = prev - 1;
          
          // Save to database every single second to maintain second-to-second persistency
          saveTimerStateToDb({
            seconds_remaining: nextSec,
            is_timer_running: true,
            current_level_index: currentLevelIdxRef.current
          });

          // Send simple tick sync locally
          broadcastChannelRef.current?.postMessage({
            type: 'TICK',
            payload: { seconds_remaining: nextSec }
          });
          // Send simple tick sync globally via WebSocket Broadcast
          realtimeChannelRef.current?.send({
            type: 'broadcast',
            event: 'TICK',
            payload: { seconds_remaining: nextSec }
          });
          return nextSec;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
...
```
The helper function `saveTimerStateToDb` is defined as follows (lines 358–373):
```typescript
  const saveTimerStateToDb = async (overrides: Partial<Tournament> = {}) => {
    try {
      await supabase
        .from('tournaments')
        .update({
          seconds_remaining: overrides.seconds_remaining ?? secondsRemainingRef.current,
          is_timer_running: overrides.is_timer_running ?? isRunningRef.current,
          current_level_index: overrides.current_level_index ?? currentLevelIdxRef.current,
          timer_reference_at: new Date().toISOString(),
          ...overrides
        })
        .eq('id', tournament.id);
    } catch (e) {
      console.error('Error saving timer state:', e);
    }
  };
```

### C. Self-Feedback Loop in the Organizer Console
`TournamentControl.tsx` is subscribed to `postgres_changes` on the `tournaments` table (lines 129–160). When an update is committed, the handler is triggered:
```typescript
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournaments',
          filter: `id=eq.${initialTournament.id}`
        },
        (payload: any) => {
          const newData = payload.new;
          if (!newData) return;
          
          // Compensate with calculated clock offset
          const derivedSeconds = deriveSecondsFromSnapshot(
            newData.seconds_remaining,
            newData.timer_reference_at,
            newData.is_timer_running
          );
          
          // Update local state from remote changes
          setTournament(prev => ({ ...prev, ...newData }));
          setSecondsRemaining(derivedSeconds);
          setIsRunning(newData.is_timer_running);
          setCurrentLevelIdx(newData.current_level_index);
        }
      )
```

### D. Time Calculation and Offset Sync
The helper `deriveSecondsFromSnapshot` calculates remaining time based on a client-side clock offset (lines 76–83 in `TournamentControl.tsx` and lines 109–116 in `TVDisplay.tsx`):
```typescript
  const deriveSecondsFromSnapshot = (dbSeconds: number, referenceAt: string | null | undefined, isRunning: boolean): number => {
    if (!isRunning || !referenceAt) return dbSeconds;
    const refTime = new Date(referenceAt).getTime();
    const nowServer = Date.now() + clockOffsetRef.current;
    const elapsed = Math.floor((nowServer - refTime) / 1000);
    return Math.max(0, dbSeconds - elapsed);
  };
```
The server offset is fetched using the REST root endpoint (lines 87–116 in `TournamentControl.tsx` and lines 242–266 in `TVDisplay.tsx`):
```typescript
    const fetchOffset = async () => {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!url || !anonKey || url === 'undefined') return;
      try {
        const start = Date.now();
        const res = await fetch(`${url}/rest/v1/`, {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`
          }
        });
        const dateHeader = res.headers.get('date');
        if (dateHeader) {
          const serverTime = new Date(dateHeader).getTime();
          const rtt = Date.now() - start;
          const clientTimeMid = start + rtt / 2;
          clockOffsetRef.current = serverTime - clientTimeMid;
        }
      } catch (e) {
        console.error('Failed to calculate server clock offset:', e);
      }
    };
```

---

## 2. Logic Chain

The combination of the observed mechanics directly explains the symptoms of timer drift, reset, and skipping:

1. **The Self-Feedback Loop & Jitter**:
   - The Organizer writes to the database *every second* (using `new Date().toISOString()` which reflects its uncorrected system clock).
   - This database write triggers the `postgres_changes` listener in the Organizer itself.
   - Upon receiving the event (typically 100ms–1500ms later depending on latency), the Organizer executes `deriveSecondsFromSnapshot` using the payload.
   - Because the RTT is variable, this calculation frequently results in a slightly different number of seconds than what the local interval has ticked to.
   - Overwriting the local state (`setSecondsRemaining(derivedSeconds)`) causes the clock to stutter (e.g., ticking `10 -> 9 -> 10 -> 9` or skipping numbers).

2. **Inaccurate Server Time Offset Calculation**:
   - The offset calculation reads the standard HTTP `Date` header.
   - HTTP `Date` headers have a resolution of **1 second** (no milliseconds). This introduces up to a 1000ms rounding error.
   - If a client refreshes (F5), a new HTTP request is sent, and the calculated offset can shift by up to a full second due to this rounding error, causing the calculated timer state to immediately drift or jump by 1–2 seconds.

3. **Background Tab Throttling (Interval Halts)**:
   - Modern browsers throttle or completely pause `setInterval` executing in background tabs or minimized windows to save power.
   - Because the database state relies on the Organizer executing `saveTimerStateToDb` every second, if the Organizer's tab goes to the background, the DB updates stop or lag.
   - As a result, the TV Displays (which listen to the DB) observe a frozen or lagging timer.

4. **Lack of Server Offset Adjustment on Writes**:
   - When updating the database, the Organizer writes `timer_reference_at = new Date().toISOString()`. This uses the local client machine's system clock.
   - If the Organizer's system clock is off by 2 minutes, it writes a timestamp 2 minutes in the future.
   - When a TV Display (with a correct clock) fetches this timestamp, it computes a negative elapsed time or a massive drift, leading to visual time jumps.

---

## 3. Caveats

- **Network Constraints**: The investigation was conducted in `CODE_ONLY` network mode, preventing external HTTP testing or connection to a live Supabase instance.
- **Supabase Free-Tier Limitations**: Although not explicitly tested, the current design of writing to the DB every second can easily exceed the free-tier rate limits and cause connection exhaustion when multiple screens are open.
- **Test Status**: Running `npm run test` indicated some pre-existing failures in dashboard views, which do not impact the timer sync mechanism directly.

---

## 4. Conclusion

To implement a bulletproof synchronization strategy that guarantees sub-second synchronization, perfect state recovery on refresh, and prevents write conflicts, we propose the following architecture:

### A. Declarative Timer Representation (Zero per-second DB writes)
Modify the database writes so they occur **only during state transitions** (Play, Pause, Level Up, Level Down, Edit Time). 
- When the timer is **Paused**:
  - `is_timer_running = false`
  - `seconds_remaining` = exact static remaining seconds.
  - `timer_reference_at` = client-synchronized server time of the pause action.
- When the timer is **Running (Play)**:
  - `is_timer_running = true`
  - `seconds_remaining` = static remaining seconds at the start of the level/resume.
  - `timer_reference_at` = client-synchronized server time when resume was clicked.

### B. High-Precision Clock Sync (Microsecond Precision)
1. Add a Postgres RPC function in the database (`supabase/schema.sql`):
   ```sql
   create or replace function public.get_server_time()
   returns timestamp with time zone as $$
     select now();
   $$ language sql security definer;
   ```
2. When clients mount, they fetch this RPC function to calculate a precise clock offset, accounting for RTT (Round Trip Time):
   ```typescript
   const start = Date.now();
   const { data: serverTimeStr } = await supabase.rpc('get_server_time');
   if (serverTimeStr) {
     const serverTime = new Date(serverTimeStr).getTime();
     const rtt = Date.now() - start;
     clockOffsetRef.current = serverTime - (start + rtt / 2);
   }
   ```

### C. Client-Side Time Derivation & Display Loop
Instead of running a 1-second interval that updates state variables, both the Organizer and the TV Displays run a fast local loop (e.g., every 100ms or 200ms) that calculates the current display time based on the absolute server reference time:
```typescript
const getRemainingSeconds = () => {
  if (!is_timer_running) return seconds_remaining;
  const nowServer = Date.now() + clockOffsetRef.current;
  const elapsed = Math.floor((nowServer - new Date(timer_reference_at).getTime()) / 1000);
  return Math.max(0, seconds_remaining - elapsed);
};
```
The UI simply displays the formatted result of `getRemainingSeconds()`. This ensures:
- Visual sync across all screens is within milliseconds.
- A page refresh (F5) recovers the state perfectly, as the math is anchored to the absolute `timer_reference_at` database timestamp.
- Tab throttling in the background is a non-issue; when the tab returns to the foreground, it calculates the correct time instantly.

### D. Separation of Roles (Write Isolation)
- **Organizer (Master)**:
  - Writes to the database only on actions (Play, Pause, Level change).
  - When saving `timer_reference_at`, it uses the aligned timestamp: `new Date(Date.now() + clockOffset).toISOString()`.
  - Dispatches immediate UI sync states via Supabase Realtime broadcast message (`STATE_UPDATE`) for instant response.
  - **Does not** overwrite its own `secondsRemaining` state from `postgres_changes` events.
- **TV Display (Passive)**:
  - Read-only; never writes to the database.
  - Subscribes to `postgres_changes` on the `tournaments` table (which now fires only when the timer starts/pauses/changes level, not every second) to fetch updated structures or player status.
  - Listens to `STATE_UPDATE` broadcasts for immediate play/pause state updates.

---

## 5. Verification Method

### 1. Verification of the Proposed RPC function
Execute the SQL command to create the function in Supabase, and call it via the JS client:
```typescript
const { data, error } = await supabase.rpc('get_server_time');
console.log("Server time:", data); // Should return timestamp with millisecond resolution
```

### 2. Synchronization Verification
1. Open the Organizer Console on Device A and the TV Display on Device B.
2. Click **Play** on the Organizer Console.
3. Verify that the database only receives **one** update query on `tournaments`.
4. Observe the timers on both screens. They must tick in perfect unison (<1s difference).
5. Minimize/background the Organizer tab on Device A for 30 seconds. Verify that the timer on Device B continues ticking correctly.
6. Refresh (F5) the TV Display on Device B while the timer is running. Verify that it recovers the exact remaining time without any jumps or resets.
7. Click **Pause** on the Organizer Console. Verify that both screens pause at the same exact second, and only **one** database update query is performed.
