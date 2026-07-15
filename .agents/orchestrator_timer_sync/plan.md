# Plan: Tournament Timer Sync and Level Progression

## Goal
Resolve the tournament timer synchronization and level progression issues across all connected devices (mobile, tablet, PC), ensuring zero drift and making sure page refreshes do not reset, skip, or drift the timer.

## Phase 1: Exploration
- **Step 1.1**: Dispatch `teamwork_preview_explorer` to explore the codebase.
- **Step 1.2**: Analyze existing database schema (specifically tables related to tournaments, timers, structures, and levels), real-time channels/subscriptions, and React/Next/Vite frontend components.
- **Step 1.3**: Identify the source of the timer drift and the page-refresh reset/skip/drift issues.
- **Step 1.4**: Propose a design contract and sync mechanism.

## Phase 2: Design and Setup
- **Step 2.1**: Create `PROJECT.md` at project root with architecture, milestones, interface contracts, and code layout.
- **Step 2.2**: Setup E2E Testing Track and write tests covering happy paths, boundary cases, network disconnects, refreshes, and concurrent writes.

## Phase 3: Implementation
- **Step 3.1**: Implement the unified timer sync backend & database updates.
- **Step 3.2**: Implement the frontend timer hooks/components supporting:
  - Absolute server time reference to ensure zero drift.
  - Quick recovery upon refresh.
  - Role-based behavior: Master Console (Organizer) vs. Passive Screens (TV, players).
- **Step 3.3**: Ensure correct level and break transitions.

## Phase 4: Verification and Audit
- **Step 4.1**: Run E2E and unit tests.
- **Step 4.2**: Dispatch `teamwork_preview_reviewer` to review codebase changes.
- **Step 4.3**: Dispatch `teamwork_preview_challenger` to test edge cases and race conditions.
- **Step 4.4**: Run `teamwork_preview_auditor` to ensure zero cheating / proper implementation.
