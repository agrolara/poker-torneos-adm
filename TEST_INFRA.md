# E2E Test Infra: Public Blind Structures Explorer & Simulator

## Test Philosophy
- **Opaque-box, requirement-driven**: All test cases exercise the features by interacting with standard browser-like API inputs and outputs (via jsdom and React Testing Library) without using internal component states or methods.
- **TDD (Test-Driven Development) & Active Gates**: Tests are implemented before the feature. Running them initially must fail on the current codebase to guarantee assertion validity.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Cross-feature) |
|---|---------|----------------------|:----------------:|:-----------------:|:---------------------:|
| F1 | Botón y Modal de Exploración Pública | ORIGINAL_REQUEST §R1 | 6 tests | 3 tests | ✓ |
| F2 | Visualización Detallada de Niveles/Descansos | ORIGINAL_REQUEST §R2 | 4 tests | 3 tests | ✓ |
| F3 | Simulador de Premios Interactivo | ORIGINAL_REQUEST §R3 | 5 tests | 9 tests | ✓ |

## Test Architecture
- **Test Runner**: Vitest (`npm run test` executes `vitest run`).
- **Test Environment**: `jsdom` (mock DOM environment) with React Testing Library.
- **Mocks Configuration**: Mocks `@supabase/supabase-js` database fetches for `blind_structures` and league codes, and `AuthContext` to run tests without database connectivity.
- **Contract Test IDs (data-testid)**:
  - Button to open explorer: `btn-explorar-estructuras`
  - Modal container: `modal-explorar-estructuras`
  - Close button: `modal-close-btn`
  - Modal title: `modal-title`
  - Database structure item: `structure-item-<structure_id>`
  - Detail back button: `detail-back-btn`
  - Level row container: `level-row-<level_number>`
  - Break row container: `break-row-<level_index>`
  - Simulator players count input: `sim-players-input`
  - Simulator buy-in amount input: `sim-buyin-input`
  - Gross pool display: `sim-gross-pool`
  - Rake deduction display: `sim-rake-deduction`
  - Net pool display: `sim-net-pool`
  - Prize distribution row: `prize-row-<position_number>` (1, 2, 3...)

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Standard Turbo Tournament Simulation (25 players, 10,000 buy-in, 3,000 rake, [50,30,20] payout) | F1, F2, F3 | Medium |
| 2 | Micro-stakes Deepstack Tournament Simulation (8 players, 2,000 buy-in, 500 rake, [70,30] payout) | F1, F2, F3 | Medium |
| 3 | High-roller Winner-Take-All Simulation (15 players, 100,000 buy-in, 10,000 rake, Winner-take-all) | F1, F2, F3 | Medium |
| 4 | Large League Event Simulation (120 players, 15,000 buy-in, 3,000 rake, [50,30,20] payout) | F1, F2, F3 | High |
| 5 | Integrated visitor workflow (explore -> select -> modify -> verify calculations -> check breaks -> close) | F1, F2, F3 | High |

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: 15 tests.
- **Tier 2 (Boundary & Corner Cases)**: 15 tests.
- **Tier 3 (Cross-Feature Combinations)**: 3 tests.
- **Tier 4 (Real-World Application Scenarios)**: 5 tests.
- **Total tests**: 38 tests.
