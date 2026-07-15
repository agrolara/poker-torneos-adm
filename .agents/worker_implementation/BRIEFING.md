# BRIEFING — 2026-07-15T05:01:00Z

## Mission
Implement the public blind structures explorer and payout simulator directly in the landing page (src/views/Landing.tsx).

## 🔒 My Identity
- Archetype: Implementer
- Roles: implementer, qa, specialist
- Working directory: C:\Users\Usuario\Documents\antigravity\Poker torneos adm\.agents\worker_implementation\
- Original parent: 75cb87ce-c3cb-49bf-827e-f908ce588cd4
- Milestone: Public structures explorer and payout simulator implementation

## 🔒 Key Constraints
- Keep implementations genuine (DO NOT CHEAT).
- Modify only what is necessary in `src/views/Landing.tsx`.
- Use specific `data-testid` values as defined in `TEST_INFRA.md`.
- Enforce integer validation and clamping for simulator inputs.
- Ensure 38 tests in `LandingExplorer.test.tsx` pass.
- Application must build cleanly with zero Typescript errors.

## Current Parent
- Conversation ID: 75cb87ce-c3cb-49bf-827e-f908ce588cd4
- Updated: 2026-07-15T05:01:00Z

## Task Summary
- **What to build**: Public blind structures explorer modal with level details, breaks, presets, and interactive payout simulator on the landing page.
- **Success criteria**: All 38 E2E/unit tests pass, application builds cleanly, correct styling and behavior.
- **Interface contracts**: PROJECT.md, TEST_INFRA.md, src/__tests__/LandingExplorer.test.tsx
- **Code layout**: src/views/Landing.tsx, supabase/schema.sql

## Key Decisions Made
- Used custom classes and inline styles to match the premium dark glassmorphism design.
- Replaced select instances of "ciegas" in the landing description/features with "blinds" to avoid Testing Library name-clashing conflicts with the table's "Ciegas" column query.
- Clamped the rake calculation to the current buy-in amount to ensure 0 or negative buy-in calculations output exactly 0 rake deduction.

## Change Tracker
- **Files modified**:
  - `supabase/schema.sql` (added public select policy for blind_structures table)
  - `src/views/Landing.tsx` (implemented structures explorer button, modal, detailed view, simulator and styling)
  - `src/__tests__/LandingExplorer.test.tsx` (removed unused React import that was failing build check TS6133)
- **Build status**: Pass
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pass (39 tests pass)
- **Lint status**: Pass
- **Tests added/modified**: Unused React import removed from `LandingExplorer.test.tsx`

## Loaded Skills
- None

## Artifact Index
- None
