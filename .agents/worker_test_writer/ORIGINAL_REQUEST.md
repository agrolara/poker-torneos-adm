## 2026-07-15T04:52:27Z
Write the E2E test suite file under `src/__tests__/LandingExplorer.test.tsx` for the public blind structures explorer and simulator.

Your working directory is: C:\Users\Usuario\Documents\antigravity\Poker torneos adm\.agents\worker_test_writer\
Follow these guidelines:
1. Ensure the directory `src/__tests__/` exists.
2. Write `src/__tests__/LandingExplorer.test.tsx` using Vitest, jsdom, and React Testing Library.
3. The test file must mock:
   - `../supabaseClient` (mocking supabase client so that select on `blind_structures` returns mock structures. Let's make sure it handles chain queries like `supabase.from('blind_structures').select('*').order('name', { ascending: true })` and returns mock structures, and handles `supabase.from('league_codes').select('*').eq(...).single()` for other login stuff).
   - `../context/AuthContext` (mocking `useAuth` to return `{ signIn: vi.fn(), signUp: vi.fn(), user: null }`).
4. Define mock structures data:
   - `struct-1` ("Estructura Semanal 1"): levels array with standard levels and breaks, defaults with buy-in 10000, rake 3000, payout_structure [50, 30, 20].
   - `struct-free` ("Freeroll Structure"): levels array, defaults with buy-in 5000, rake 0, payout_structure [100].
   - `struct-100rake` ("100 Percent Rake Structure"): levels array, defaults with buy-in 5000, rake 5000, payout_structure [50, 30, 20].
   - `struct-nodefaults` ("Bare Structure"): levels array directly, defaults is missing.
5. Implement exactly 38 tests grouped under describes, matching the 4-tier plan in `C:\Users\Usuario\Documents\antigravity\Poker torneos adm\.agents\sub_orch_e2e_testing\SCOPE.md`.
6. Use clear assertions, querying elements by data-testid or screen text. Define the following data-testid contracts in your tests:
   - Explorar button: `data-testid="btn-explorar-estructuras"`
   - Modal container: `data-testid="modal-explorar-estructuras"`
   - Close button: `data-testid="modal-close-btn"`
   - Modal title: `data-testid="modal-title"`
   - Structure item list row: `data-testid="structure-item-struct-1"`
   - Back button in detail view: `data-testid="detail-back-btn"`
   - Detail view level row: `data-testid="level-row-1"`
   - Detail view break row: `data-testid="break-row-1"` or highlighted with green color.
   - Payout simulator players input: `data-testid="sim-players-input"`
   - Payout simulator buy-in input: `data-testid="sim-buyin-input"`
   - Gross pool output: `data-testid="sim-gross-pool"`
   - Rake output: `data-testid="sim-rake-deduction"`
   - Net pool output: `data-testid="sim-net-pool"`
   - Prize row for position N: `data-testid="prize-row-N"`

Let's double-check all 38 test names:
- Tier 1: F1-T1-01 to F1-T1-06, F2-T1-07 to F2-T1-10, F3-T1-11 to F3-T1-15.
- Tier 2: F1-T2-01 to F1-T2-03, F2-T2-04 to F2-T2-06, F3-T2-07 to F3-T2-15.
- Tier 3: COM-T3-01 to COM-T3-03.
- Tier 4: APP-T4-01 to APP-T4-05.

7. Execute `npm run test` (which runs `vitest run`) and capture the output. Ensure the tests fail as expected because the feature is not yet implemented. This confirms the assertions are active.
8. Update your progress.md regularly.
9. Deliver a brief handoff report detailing the output of `npm run test` and confirming that the test file has been written.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
