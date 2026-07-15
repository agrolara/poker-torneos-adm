# Detailed Test Specifications (60 Test Cases)

This file contains the exact requirements and assertions for the 60 test cases to be written in `src/__tests__/TimerSync.test.tsx`.

## Tier 1: Feature Coverage (25 tests)

### F1: Play/Pause Synchronization
1. **F1-T1-01**: Toggling play on `TournamentControl` sets `is_timer_running` to true and updates the tournament status in the database.
2. **F1-T1-02**: Toggling pause on `TournamentControl` sets `is_timer_running` to false and updates the tournament status in the database.
3. **F1-T1-03**: When timer is running, the remaining seconds decrement by 1 every second.
4. **F1-T1-04**: When timer is paused, the remaining seconds remain static and do not decrement.
5. **F1-T1-05**: Play/pause buttons and icons in `TournamentControl` toggle visually to match the state.

### F2: Level Progression & Jump
6. **F2-T1-06**: Clicking the fast-forward level button increments the level index and updates the database.
7. **F2-T1-07**: Clicking the rewind level button decrements the level index and updates the database.
8. **F2-T1-08**: Auto-progression: when remaining seconds hit 0, the level index automatically increments, and seconds reset to the next level's duration.
9. **F2-T1-09**: TV display shows correct break banner/styles when current level is marked as a break.
10. **F2-T1-10**: Manual level jump immediately updates the blind and ante values on both Controller and TV display.

### F3: State Persistence & Reload
11. **F3-T1-11**: Initial render of `TournamentControl` computes accurate remaining seconds using `timer_reference_at`.
12. **F3-T1-12**: Initial render of `TVDisplay` computes accurate remaining seconds using `timer_reference_at`.
13. **F3-T1-13**: Refresh/load when paused: displays the static `seconds_remaining` from database.
14. **F3-T1-14**: Refresh/load when running: calculates elapsed seconds since `timer_reference_at` and subtracts from `seconds_remaining`.
15. **F3-T1-15**: If elapsed time exceeds remaining seconds on load, progression triggers immediately.

### F4: Clock Drift & Browser Backgrounding
16. **F4-T1-16**: Positive server clock offset (client clock is ahead of server) is calculated and applied to derived time.
17. **F4-T1-17**: Negative server clock offset (client clock is behind server) is calculated and applied to derived time.
18. **F4-T1-18**: Tab backgrounding: when page is hidden, the timer continues calculating correctly in the background via visibilitychange checks.
19. **F4-T1-19**: Tab reactivation catches up: advancing timers and triggering `visibilitychange` to 'visible' adjusts seconds correctly.
20. **F4-T1-20**: TVDisplay catches up after backgrounding using the same server-time reference calculation.

### F5: Multi-client Coordination
21. **F5-T1-21**: `TournamentControl` subscribes to real-time database updates for its tournament ID.
22. **F5-T1-22**: `TVDisplay` subscribes to real-time database updates for the specified tournament ID.
23. **F5-T1-23**: `TournamentControl` broadcasts ticking seconds to local tabs via `BroadcastChannel`.
24. **F5-T1-24**: `TournamentControl` broadcasts ticks globally via Supabase real-time channel.
25. **F5-T1-25**: New `TVDisplay` broadcasts `REQUEST_STATE` on load, and `TournamentControl` responds with current state.

---

## Tier 2: Boundary & Corner Cases (25 tests)

### F1: Play/Pause Boundaries
26. **F1-T2-01**: Rapid double clicks on play do not spawn multiple ticking intervals.
27. **F1-T2-02**: Clicking play when remaining seconds is 0 on final level keeps it at 0 without crashing.
28. **F1-T2-03**: Play/pause toggling handles database write errors gracefully, displaying a temporary UI error alert.
29. **F1-T2-04**: Database connection dropped during play: timer continues local ticking and shows offline badge.
30. **F1-T2-05**: Play/pause state toggles from running to paused while tab visibility is hidden.

### F2: Level Progression Boundaries
31. **F2-T2-06**: Clicking rewind when on first level does not go below index 0.
32. **F2-T2-07**: Clicking fast-forward when on final level does not exceed maximum level index.
33. **F2-T2-08**: Transitioning when level duration is 1 second operates successfully.
34. **F2-T2-09**: Structure with empty levels list displays safe defaults and does not throw null reference errors.
35. **F2-T2-10**: DB returns invalid level index (out of range): handles gracefully and falls back to level 0.

### F3: State Persistence Boundaries
36. **F3-T2-11**: Server offset query returns timeout/error: falls back to local client time (offset = 0).
37. **F3-T2-12**: `timer_reference_at` is null in database: displays static `seconds_remaining` and does not run.
38. **F3-T2-13**: `timer_reference_at` is in the future: handles negative elapsed time gracefully (caps elapsed at 0).
39. **F3-T2-14**: Refresh when elapsed time is exactly equal to remaining seconds triggers progression.
40. **F3-T2-15**: Reload when tournament status is `'completed'` forces remaining seconds to 0 and disables timer control buttons.

### F4: Clock Drift & Browser Backgrounding Boundaries
41. **F4-T2-16**: Massive client clock drift (e.g. 24 hours) is calculated and compensated correctly.
42. **F4-T2-17**: Visibilitychange to 'visible' when paused does not decrement any remaining time.
43. **F4-T2-18**: Rapidly toggling tab visibility between hidden and visible does not cause timer jitter.
44. **F4-T2-19**: Browser suspends during a transition to break: wakes up on break with correct break countdown.
45. **F4-T2-20**: Background visibility status stays hidden for 2 hours: resumes to final level / completed state correctly.

### F5: Multi-client Boundaries
46. **F5-T2-21**: Client console and TV display have different local times: both display the exact same time remaining using server time reference.
47. **F5-T2-22**: WebSocket broadcast payload is corrupt/malformed: ignored without crashing.
48. **F5-T2-23**: Concurrent controller edits: conflict is resolved via last-write-wins.
49. **F5-T2-24**: Supabase channel subscription fails (disconnected state): shows offline banner/badge.
50. **F5-T2-25**: Multiple TV displays in separate tabs sync local ticks over BroadcastChannel with minimal WebSocket traffic.

---

## Tier 3: Cross-Feature Combinations (5 tests)

51. **CROSS-01**: Pause timer exactly at the sub-second of level transition: verify timer halts at the start of the next level.
52. **CROSS-02**: Refresh page exactly at the sub-second of level transition: verify the next level loads with full duration.
53. **CROSS-03**: Level index is changed manually in Tab A while Tab B is hidden; Tab B becomes visible and displays new level index and reset time.
54. **CROSS-04**: WebSocket disconnects during active play, but local BroadcastChannel keeps local tabs in sync; once WebSocket reconnects, it syncs back.
55. **CROSS-05**: Controller A pauses while Controller B jumps level simultaneously: TV display reflects paused at the new level.

---

## Tier 4: Real-World Scenarios (5 tests)

56. **SCENARIO-01**: **Full Tournament Simulation**: Run 3 levels (Level 1, Break, Level 2) with pause, resume, auto-transition, refresh, and verify state display transitions.
57. **SCENARIO-02**: **Network Sync Recovery**: Active timer, network disconnects (mocked), pause toggled, local clock decrements, network reconnects, state sync is restored.
58. **SCENARIO-03**: **Multi-Tab Sync with Clock Drift**: 1 Controller (drift +5s), TV1 (drift -3s), TV2 (drift 0) all show identical synchronized time using absolute server time reference.
59. **SCENARIO-04**: **Break Transition and Warnings**: Verify 60s warning audio/visual cues, and voice/audio alarm when level hits 0 and transitions to break.
60. **SCENARIO-05**: **Tournament Operations during Ticking**: Late registration adds player during active countdown, verify timer runs continuously without lag or state reset.
