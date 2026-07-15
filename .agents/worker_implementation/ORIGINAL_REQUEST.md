## 2026-07-15T04:55:27Z
You are the Implementation Worker. Your role is to drive the implementation of the public blind structures explorer and payout simulator directly in the landing page (src/views/Landing.tsx).
Your working directory is: C:\Users\Usuario\Documents\antigravity\Poker torneos adm\.agents\worker_implementation\
You must:
1. Initialize your BRIEFING.md and progress.md in your working directory.
2. Read the project scope in ORIGINAL_REQUEST.md and PROJECT.md.
3. Review the E2E test infra in TEST_INFRA.md and the test suite in src/__tests__/LandingExplorer.test.tsx.
4. Update `supabase/schema.sql` to include a public select policy for the `blind_structures` table:
   `create policy "Anyone can view blind structures" on public.blind_structures for select using (true);`
   (Make sure to drop it first if it exists, or check the table policies structure in the schema).
5. Implement the public explorer button, modal, detailed view of levels and green breaks, and the interactive payout simulator in `src/views/Landing.tsx`.
   - Make sure to use the exact `data-testid` values listed in `TEST_INFRA.md`:
     * Button to open explorer: `btn-explorar-estructuras`
     * Modal container: `modal-explorar-estructuras`
     * Close button: `modal-close-btn`
     * Modal title: `modal-title`
     * Database structure item: `structure-item-<structure_id>`
     * Detail back button: `detail-back-btn`
     * Level row container: `level-row-<level_number>`
     * Break row container: `break-row-<level_index>` (1-indexed base: `break-row-1`, `break-row-4` depending on row index in the levels mapping loop)
     * Scrollable container of level list: `levels-container` (ensure the container has scroll/overflow-y styles/classes)
     * Simulator players count input: `sim-players-input`
     * Simulator buy-in amount input: `sim-buyin-input`
     * Gross pool display: `sim-gross-pool`
     * Rake deduction display: `sim-rake-deduction`
     * Net pool display: `sim-net-pool`
     * Prize distribution row: `prize-row-<position_number>` (1, 2, 3...)
   - The interactive simulator inputs should be pre-populated with structure defaults.
   - Enforce that players count input only contains integers (round floats, clamp negative numbers to 0).
   - Enforce that buy-in input clamps negative values to 0.
   - Payout calculations:
     * Gross Pool = Players * Buy-in
     * Rake deduction = Players * structure_rake
     * Net Pool = Gross Pool - Rake deduction
     * Prizes = Net Pool * percentage from structure's payout_structure
   - Standard structures should show presets (Turbo, Estándar, Deepstack) alongside database structures as fallback or additional choices.
   - The UI layout must stack components vertically on mobile screens (viewport < 480px) and maintain the app's premium dark glassmorphism styling.
6. Verify your implementation by running the E2E tests: `npx vitest run src/__tests__/LandingExplorer.test.tsx` (or `npm run test` if configured). Ensure all 38 tests pass.
7. Run the application build to ensure typescript compiles with zero errors: `npm run build`.
8. Write your handoff.md in your working directory.
9. Send a handoff message back to me (Conversation ID: 75cb87ce-c3cb-49bf-827e-f908ce588cd4) when done.

MANDATORY INTEGRITY WARNING — include this verbatim in the Worker's dispatch prompt:
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A Forensic Auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.
