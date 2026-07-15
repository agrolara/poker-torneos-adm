# E2E Test Infra: Tournament Timer Synchronization and Level Progression

## Test Philosophy
- **Opaque-box, requirement-driven**: All test cases exercise the features by interacting with React components (TournamentControl and TVDisplay) using standard user events and querying DOM elements via jsdom and React Testing Library, without depending on or exposing internal component states or private methods.
- **Declarative Synchronization**: The tests verify that client screens compute the remaining time dynamically based on a database-persisted absolute server time reference and offset, rather than relying on local interval drift or continuous database writes.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Cross-feature) |
|---|---------|----------------------|:----------------:|:-----------------:|:---------------------:|
| F1 | Play/Pause Synchronization | ORIGINAL_REQUEST §1 | 5 tests | 5 tests | ✓ |
| F2 | Level Progression & Jump | ORIGINAL_REQUEST §1 | 5 tests | 5 tests | ✓ |
| F3 | State Persistence & Reload | ORIGINAL_REQUEST §1 | 5 tests | 5 tests | ✓ |
| F4 | Clock Drift & Browser Backgrounding | ORIGINAL_REQUEST §1 | 5 tests | 5 tests | ✓ |
| F5 | Multi-client Coordination | ORIGINAL_REQUEST §1 | 5 tests | 5 tests | ✓ |

## Test Architecture
- **Test Runner**: Vitest (`npm run test` or `vitest run`).
- **Test Environment**: `jsdom` with React Testing Library.
- **Mocks Configuration**: 
  - Mock Supabase client (`@supabase/supabase-js`) to handle tournament queries, updates, real-time channel subscriptions, and broadcast message handling.
  - Mock `BroadcastChannel` to simulate local multi-tab message broadcasting.
  - Mock `window.location` to test dynamic tournament ID parsing via search parameters.
  - Mock server time query (`get_server_time()` Postgres RPC or fetch headers) to verify clock drift offsets.
  - Mock `document.visibilityState` and `visibilitychange` events to simulate browser backgrounding and tab wake-up.
- **Contract Test IDs (data-testid)**:
  - Timer status container/text: `timer-status`
  - Play button: `timer-play-btn`
  - Pause button: `timer-pause-btn`
  - Fast-forward level button: `timer-forward-btn`
  - Rewind level button: `timer-rewind-btn`
  - Seconds remaining display: `timer-seconds-display`
  - Current level index label: `timer-level-index`
  - Blind/Ante structure labels: `timer-blinds-display`
  - TV Display state container: `tv-display-container`

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Standard Tournament Flow (Levels 1-2, pause/resume, auto-level transition, TV screen updates) | F1, F2, F3, F5 | Medium |
| 2 | Admin Controller Reload & Re-sync (Refresh mid-play, recalculates seconds correctly via ref timestamp) | F1, F3, F4 | Medium |
| 3 | Browser Tab Suspension Recovery (Tab backgrounded for 3 minutes, wakes up, adjusts time dynamically) | F1, F4, F5 | High |
| 4 | Network/WebSocket Disconnect & Reconnect Sync (DB update occurs while WS is offline, reconnect fetches DB) | F3, F5 | High |
| 5 | Multi-client Simultaneous Interaction (Organizers pause, TV screens instantly reflect calculations, no tick drift) | F1, F2, F5 | High |

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: 25 tests.
- **Tier 2 (Boundary & Corner Cases)**: 25 tests.
- **Tier 3 (Cross-Feature Combinations)**: 5 tests.
- **Tier 4 (Real-World Application Scenarios)**: 5 tests.
- **Total minimum**: 60 tests.
