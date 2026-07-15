# Scope: Public Blind Structures Explorer and Simulator E2E Testing

This document outlines the test plan, infrastructure, and test cases designed for the public structures explorer and simulator component on the Landing Page.

## Test Philosophy
- **Opaque-box, requirement-driven**: Tests interact with the UI elements as a visitor would (clicking buttons, entering values in inputs, reading text fields). No internal implementation details are accessed.
- **TDD / Active Gate**: Tests are written and run first on the current codebase to confirm they fail (validating the assertions are active). They will pass once the implementation is complete.

## Test Infrastructure
- **Test Runner**: Vitest (or custom node runner). We will configure Vitest with React Testing Library (RTL) and jsdom to run React component tests efficiently.
- **Environment**: jsdom to mock browser APIs.
- **Supabase Mocking**: Mock Supabase client responses for fetching `blind_structures` to test various states (success with custom data, empty list, error state).

## Features to Test
- **F1: Botón y Modal de Exploración Pública**
  - Unauthenticated access to the explorer modal from the landing page.
  - Responsive layout, backdrop closing, list rendering, presets inclusion.
- **F2: Visualización Detallada de Niveles y Descansos**
  - Table showing levels, blinds, ante, duration.
  - Visual highlighting of breaks in green style.
- **F3: Simulador de Premios Interactivo**
  - Real-time payout calculations for Gross, Rake, Net, and podio payouts based on player count and buy-in inputs.

## 4-Tier Test Suite (38 Tests)

### Tier 1: Feature Coverage (15 tests)
1. **F1-T1-01**: Check button "Explorar Estructuras de Ciegas" is present on the public landing page.
2. **F1-T1-02**: Modal opens when clicking the exploration button.
3. **F1-T1-03**: Modal displays loading state/skeleton initially.
4. **F1-T1-04**: Modal displays loaded public blind structures from database.
5. **F1-T1-05**: Modal displays standard system preset structures.
6. **F1-T1-06**: Modal closes when clicking the close (X) button.
7. **F2-T1-07**: Clicking a structure displays its detailed level list.
8. **F2-T1-08**: Level detail list displays correct columns: Level, Blinds, Ante, Duration.
9. **F2-T1-09**: Back button in detail view returns to the structures list.
10. **F2-T1-10**: Breaks (is_break: true) are visually highlighted (green styling/elements).
11. **F3-T1-11**: Payout Simulator inputs (Players, Buy-in) are displayed.
12. **F3-T1-12**: Payout Simulator inputs are pre-populated with structure defaults.
13. **F3-T1-13**: Gross Pool is calculated correctly as Players * Buy-in.
14. **F3-T1-14**: Net Pool is calculated correctly by subtracting Rake from Gross Pool.
15. **F3-T1-15**: Payout list displays correct podio percentages and CLP payout amounts.

### Tier 2: Boundary & Corner Cases (15 tests)
16. **F1-T2-01**: Handling of empty structures list from the database (renders empty state).
17. **F1-T2-02**: Handling of database query error (renders error alert, doesn't crash).
18. **F1-T2-03**: Modal closes when clicking the backdrop overlay.
19. **F2-T2-04**: Structure with 0 standard levels (only breaks) displays breaks correctly.
20. **F2-T2-05**: Structure with a large number of levels renders within scrollable container.
21. **F2-T2-06**: Structure with very long name is wrapped or truncated gracefully.
22. **F3-T2-07**: Payout Simulator with 0 players calculates 0 Gross, 0 Rake, 0 Net.
23. **F3-T2-08**: Payout Simulator with 0 buy-in calculates 0 Gross, 0 Rake, 0 Net.
24. **F3-T2-09**: Payout Simulator with negative player count (treated as 0/validated).
25. **F3-T2-10**: Payout Simulator with negative buy-in (treated as 0/validated).
26. **F3-T2-11**: Structure with 0% rake (defaults.rake_amount = 0) calculates 0 Rake and Net Pool = Gross Pool.
27. **F3-T2-12**: Structure with 100% rake (rake_amount = buy_in_amount) calculates Net Pool = 0.
28. **F3-T2-13**: Payout option "Ganador toma todo" (100% to 1st) renders only 1 prize row.
29. **F3-T2-14**: Structure with missing `defaults` in levels column handles fallback defaults.
30. **F3-T2-15**: Payout Simulator handles floating-point player count (rounds or rejects).

### Tier 3: Cross-Feature Combinations (3 tests)
31. **COM-T3-01**: Switching structures resets inputs to new structure's defaults if custom, or system defaults.
32. **COM-T3-02**: Modifying inputs, returning back, and selecting a new structure updates calculations with new structure parameters.
33. **COM-T3-03**: Layout adaptivity elements check: ensures flex direction classes stack elements on small viewport sizes.

### Tier 4: Real-World Application Scenarios (5 tests)
34. **APP-T4-01**: Standard Turbo Tournament Simulation (25 players, 10,000 buy-in, 3,000 rake, [50,30,20] payout).
35. **APP-T4-02**: Micro-stakes Deepstack Tournament Simulation (8 players, 2,000 buy-in, 500 rake, [70,30] payout).
36. **APP-T4-03**: High-roller Winner-Take-All Simulation (15 players, 100,000 buy-in, 10,000 rake, Winner-take-all).
37. **APP-T4-04**: Large League Event Simulation (120 players, 15,000 buy-in, 3,000 rake, [50,30,20] payout).
38. **APP-T4-05**: Fully integrated visitor workflow (explore -> select structure -> modify players -> modify buy-in -> verify calculations -> check breaks -> close modal).
