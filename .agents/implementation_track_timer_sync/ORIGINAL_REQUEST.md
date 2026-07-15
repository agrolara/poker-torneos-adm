# Original User Request

## Initial Request — 2026-07-15T03:16:08-04:00

You are Implementation Track Orchestrator for the tournament timer sync task.
Your TypeName is self (or teamwork_preview_orchestrator).
Your working directory is C:\Users\Usuario\Documents\antigravity\Poker torneos adm\.agents\implementation_track_timer_sync
Your parent is 2451942c-5270-479b-99d4-b82eae321691 (Project Orchestrator).

Objective:
Implement the database RPC and backend/frontend timer synchronization and level progression improvements, and make sure 100% of E2E tests in the test suite pass.
Scope:
1. Initialize SCOPE.md in your working directory.
2. Implement:
   - Database RPC `get_server_time()` in `supabase/schema.sql`.
   - Transitions-only database updates in `TournamentControl.tsx`. (Instead of per-second DB writes, write only when play/pause/level change/manual time edit occurs).
   - High-precision clock offset calculation using the server RPC and RTT compensation.
   - Client-side time derivation and display loop using a fast intervals hook or function in both `TournamentControl.tsx` and `TVDisplay.tsx`.
   - Clean level and break transitions at 0 seconds remaining.
   - Separation of roles: Organizer writes to DB on transitions and broadcasts updates; TV Display/passive displays listen to broadcast / DB changes and derive ticks locally (never write).
3. Poll/Wait for `TEST_READY.md` to be created by the Testing Track Orchestrator. Once ready, execute Phase 1: verify and pass all Tier 1-4 tests by spawning worker, reviewers, challengers, and forensic auditor.
4. Execute Phase 2 (Adversarial Coverage Hardening): spawn Challenger to analyze implementation and write Tier 5 adversarial tests, then fix any exposed issues.
5. Run the Forensic Auditor (`teamwork_preview_auditor`) to verify implementation integrity and zero cheat detection.

Rules:
- DO NOT write code yourself; spawn teamwork_preview_worker to write database migrations/scripts and code changes, teamwork_preview_reviewer for reviewing, teamwork_preview_challenger for testing, and teamwork_preview_auditor for forensic audit.
- Integrity warning MUST be forwarded verbatim in all worker prompts: "DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work."
- Never write, modify, or create source code/test files directly (only metadata/state .md in .agents/ folder).
- Keep progress.md in your folder updated.
- When done, write handoff.md and send a completion message to the parent (2451942c-5270-479b-99d4-b82eae321691).
