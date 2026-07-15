# Plan: Phase 2 Dashboard Enhancement

## Objectives
Enhance `Dashboard.tsx` with:
1. Advanced financial KPIs (Premios Distribuidos, Rake de Liga Acumulado, Promedio de Recompras).
2. Historical tournaments list with mini-podiums (🥇, 🥈, 🥉 names) and financial metrics (Recaudación, Rake, Net Pool).
3. Expanded leaderboard with columns PJ, Victorias, and position trends (▲, ▼, ●).
4. Responsive design down to 320px screen width.

## Milestones
- **M7: Phase 2 Test Track**: Write opaque-box Vitest integration/E2E tests in `src/__tests__/DashboardEnhancement.test.tsx` verifying KPIs, history mini-podiums, expanded leaderboard columns, and chronological trend calculations.
- **M8: Dashboard Enhancements**:
  - Update `Dashboard.tsx` state to keep `allTournamentPlayers` in state.
  - Implement R1 Advanced KPIs in the top grid. Ensure responsive layout using `repeat(auto-fit, minmax(220px, 1fr))`.
  - Implement R2 Completed Tournaments enrichment with podio search and financial calculations.
  - Implement R3 Leaderboard expansion with table columns for PJ, V, Pts, and chronological trend calculations.
  - Implement R4 Mobile responsive layouts and flex-wrapping.
- **M9: Phase 2 Verification & Audit**:
  - Run and verify all Vitest tests.
  - Run Challenger empirical verification.
  - Run Forensic Audit.
