# Project: Estructuras y Simulador de Premios Explorer

## Architecture
The application is a Vite-based React single page application using Supabase for database storage and user authentication.
- `src/views/Landing.tsx`: Public entry point. Currently shows standard features, super admin access, and league access.
- `src/supabaseClient.ts`: Supabase client configuration.
- `supabase/schema.sql`: Database schema definition including `blind_structures` table.

We will implement the public structures explorer directly in `src/views/Landing.tsx` as a responsive modal, loaded asynchronously from the `blind_structures` table.

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | E2E Testing Track | Set up test infrastructure (Vitest/testing-library) and implement opaque-box test cases for Tiers 1-4. Publish `TEST_READY.md`. | None | DONE |
| M2 | Database Policy & RLS | Verify and update database RLS policies to allow unauthenticated (public) select on `blind_structures`. | None | DONE (Conv: 5eaff998-822b-4060-a889-c02a6b915fc4) |
| M3 | Public Explorer UI | Add a button and responsive modal in `Landing.tsx` to load and display list of blind structures asynchronously. | M2 | DONE (Conv: 5eaff998-822b-4060-a889-c02a6b915fc4) |
| M4 | Levels & Breaks Display | Render levels and breaks for the selected structure, highlighting breaks in green. | M3 | DONE (Conv: 5eaff998-822b-4060-a889-c02a6b915fc4) |
| M5 | Payout Simulator | Add an interactive payout simulator calculating Gross Pool, Rake, Net Pool, and exact prize distributions in real-time. | M4 | DONE (Conv: 5eaff998-822b-4060-a889-c02a6b915fc4) |
| M6 | E2E Test Verification | Ensure 100% of E2E tests pass, then run white-box adversarial coverage checks (Tier 5) and resolve any gaps. | M1, M5 | DONE |

## Code Layout
- `src/views/Landing.tsx`: Implementation of landing page and the public structures explorer modal.
- `src/__tests__/`: Folder containing test files.
- `src/__tests__/LandingExplorer.test.tsx`: E2E/Integration tests for the structures explorer.
- `supabase/migrations/`: Database migration scripts if needed for RLS updates.
- `PROJECT.md`: Main project tracking and architecture document.
- `TEST_INFRA.md`: Details of the test cases and setup (created by Testing Track).
