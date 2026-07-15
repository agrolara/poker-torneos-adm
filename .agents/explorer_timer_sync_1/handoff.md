# Forensic Audit Analysis and Fix Strategy Report

## 1. Observation
After conducting a detailed, read-only analysis of `src/__tests__/TimerSync.test.tsx` and the Forensic Auditor's handoff report, we verified the following issues:

1. **Two Failing Test Cases**:
   * Running `cmd /c npx vitest run src/__tests__/TimerSync.test.tsx` results in 58 passing tests and 2 failing tests:
     * `F2-T1-08: Auto-progression: when remaining seconds hit 0, the level index automatically increments, and seconds reset to the next level's duration`
     * `SCENARIO-01: Full Tournament Simulation: Run 3 levels (Level 1, Break, Level 2) with pause, resume, auto-transition, refresh, and verify state display transitions`
     * Verbatim failure log:
       ```
       AssertionError: expected +0 to be 1 // Object.is equality
       - Expected
       + Received
       - 1
       + 0
       ```

2. **Batched Clock Advance Failure**:
   * The failures are caused by the time-progression helper `advanceTimeAndFlush` (line 282):
     ```typescript
     const advanceTimeAndFlush = async (ms: number) => {
       if (ms > 5000) {
         await act(async () => {
           vi.advanceTimersByTime(ms);
         });
       } else { ... }
     ```
     When advancing by more than 5000ms (such as 11000ms or 16000ms), Vitest advances the virtual clock all at once. The internal interval runs 110+ times synchronously in a single JS macro-task. Because React does not commit state changes or execute hooks (like updating `currentLevelIdxRef.current` via `useEffect`) between these ticks, the ref remains `0` throughout the entire advancement. This batches state updates incorrectly and prevents correct multi-level progressions.

3. **Over 30 Facade Test Cases (DOM Existence Assertions)**:
   * Test cases assert only `expect(container).toBeInTheDocument()` instead of checking the actual timer state, blind values, or active clock decrements.
   * Examples:
     * Line 437 (`F3-T1-11`): Initial render of TournamentControl computes accurate remaining seconds...
     * Line 446 (`F3-T1-12`): Initial render of TVDisplay computes accurate remaining seconds...
     * Line 481 (`F4-T1-16`) and Line 489 (`F4-T1-17`): Server clock offsets...
     * Line 496 (`F4-T1-18`), Line 506 (`F4-T1-19`), Line 516 (`F4-T1-20`): Browser backgrounding/reactivation...

4. **Trivial Instance Mock Assertions**:
   * Several tests assert only that a BroadcastChannel was created (e.g. `expect(broadcastChannelInstances.length).toBeGreaterThan(0)`) without checking actual message transmissions, level jumps, or state sync:
     * Line 806 (`CROSS-04`), Line 813 (`CROSS-05`), Line 832 (`SCENARIO-02`), Line 838 (`SCENARIO-03`).

5. **Static Dummy check in Voice Synthesis (SCENARIO-04)**:
   * Line 845: Asserts `expect(mockSpeak).toBeDefined();` to verify the voice alarm, but `mockSpeak` is a global mock function initialized with `vi.fn()` and is always defined, bypassing whether it was actually called or what it spoke.

6. **Contradictory/Incomplete assertion in Late Registration (SCENARIO-05)**:
   * Line 854: Claims to verify that the "timer runs continuously without lag or state reset" during late registration. But the test does not add any players (late registration) and asserts `expect(mockTournamentData.is_timer_running).toBe(false);` which directly contradicts the test description.

---

## 2. Logic Chain
1. A legitimate E2E test suite must verify that features perform correctly according to the project specifications (e.g. remaining seconds decrement, clock drift offsets adjust calculations, backgrounding recalculates elapsed time, and disconnect/reconnect sync recovers states).
2. The current test suite contains dummy/facade test cases that bypass actual behavioral verification.
3. The failing tests (`F2-T1-08` and `SCENARIO-01`) fail because advancing time by a large step inside a single `act` block executes all interval ticks in a single batch, preventing React from updating state refs between ticks.
4. Rewriting the test suite to:
   * Step the virtual clock in small, discrete steps of 100ms (forcing React commits and ref updates).
   * Replace trivial `toBeInTheDocument` with actual DOM/state checks.
   * Simulate multi-client communication by mock-dispatching events on BroadcastChannel and Supabase channels.
   * Enable TV voice synthesis in tests and inspect `mockSpeak` calls.
   * Implement full late registration UI interactions and verify mock insertions.
   will fix the failures and elevate the test suite to a genuine E2E behavioral verification suite.

---

## 3. Caveats
No caveats. The source code of `TournamentControl.tsx` and `TVDisplay.tsx` was fully audited to verify the class names, selectors, button titles, and database interactions.

---

## 4. Conclusion
The current test suite is a facade implementation with integrity issues. A concrete fix strategy is required to rewrite the tests for genuine behavioral verification.

---

## 5. Verification Method

To verify the recommendations and the subsequent implementation, run:
```cmd
cmd /c npx vitest run src/__tests__/TimerSync.test.tsx
```
The test suite must pass 60/60 tests, and all facade checks must be replaced with genuine assertions.

---

## 6. Detailed Rewrite Strategy

### Step 1: Fix the Time Progression Helper (`advanceTimeAndFlush`)
Change `advanceTimeAndFlush` to always advance time in 100ms steps, so React has the opportunity to commit state changes and execute effects:
```typescript
const advanceTimeAndFlush = async (ms: number) => {
  const steps = Math.ceil(ms / 100);
  for (let i = 0; i < steps; i++) {
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
  }
  // Flush any remaining microtasks
  await act(async () => {
    await Promise.resolve();
  });
};
```

### Step 2: Replace Trivial DOM Assertions
Replace `expect(container).toBeInTheDocument()` with specific text displays or state validations:
* **Timer Countdown Checks (`F1-T1-03`)**:
  ```typescript
  const timerDisplay = container.querySelector('.control-timer-display');
  expect(timerDisplay?.textContent).toContain('09:59'); // decremented by 1s
  ```
* **Clock Offset Checks (`F4-T1-16` / `F4-T1-17`)**:
  Verify that the displayed time is compensated for the offset (e.g. if the client is ahead of the server by 5 seconds, the remaining seconds displayed are adjusted).
* **Background Catch Up (`F4-T1-18` / `F4-T1-19` / `F4-T1-20`)**:
  Verify that after triggering the visibility change from hidden back to visible, the elapsed seconds are subtracted correctly and the display reflects the new time.

### Step 3: Implement Genuine Cross-Tab and WebSocket Communication Tests
* **Cross-Tab Sync (`CROSS-04` / `CROSS-05`)**:
  Simulate BroadcastChannel messages by triggering `onmessage` on the mock instances and verifying that the components update their UI state (e.g., matching timers and blind structures).
  ```typescript
  // Trigger BroadcastChannel message to TVDisplay
  await act(async () => {
    broadcastChannelInstances[1].onmessage({
      data: {
        type: 'STATE_UPDATE',
        payload: { ...mockStatePayload }
      }
    });
  });
  // Assert TVDisplay updates to match payload
  ```

### Step 4: Fix voice warning validation in SCENARIO-04
1. Click the "Voz Silenciada" button in `TVDisplay` to change it to "Voz Activada" (so that `voiceEnabled` is true).
2. Start the timer at 61 seconds.
3. Advance the timer by 1000ms and verify:
   ```typescript
   expect(mockSpeak).toHaveBeenCalledWith(
     expect.objectContaining({ text: "¡Último minuto de nivel!" })
   );
   ```
4. Clear mock calls, mock-dispatch a state change to the break level, and verify:
   ```typescript
   expect(mockSpeak).toHaveBeenCalledWith(
     expect.objectContaining({ text: "¡Tiempo de descanso! Iniciamos un descanso de 5 minutos." })
   );
   ```

### Step 5: Fix Late Registration flow in SCENARIO-05
1. Set `mockTournamentData.is_timer_running = true` and `mockTournamentData.status = 'running'`.
2. Update the mock `insert` method in `supabase` to append inserted player records to `mockPlayersData`:
   ```typescript
   insert: vi.fn().mockImplementation((payload) => {
     if (currentTable === 'tournament_players') {
       const arr = Array.isArray(payload) ? payload : [payload];
       arr.forEach(p => {
         mockPlayersData.push({
           id: `tp-${mockPlayersData.length + 1}`,
           rebuys_count: 0,
           has_add_on: false,
           status: 'active',
           elimination_position: null,
           payout_amount: 0,
           ...p
         });
       });
     }
     return mockChain;
   })
   ```
3. Open the late registration modal by clicking the `"Registro Tardío"` button.
4. Find the guest name input by placeholder `"Ej. Juan Pérez"`, and change its value to `"Invitado Tardio"`.
5. Click the `"Registrar"` button.
6. Verify that:
   * The new player is written to the database (and thus `mockPlayersData` contains the record).
   * The player list updates and shows `"Invitado Tardio"`.
   * The timer display continues ticking down normally without resets.
