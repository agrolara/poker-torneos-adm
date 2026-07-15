# E2E Test Suite Ready

## Test Runner
- Command: `npm run test` (runs `vitest run` under the hood)
- Expected: 1 smoke test passes, 38 E2E explorer tests fail on current codebase (active gate setup), and will pass 100% with exit code 0 once the implementation track is complete.

## Coverage Summary
| Tier | Count | Description |
|------|------:|-------------|
| 1. Feature Coverage | 15 | Verifies all key features of the modal, structure lists, preset listings, details, breaks rendering, inputs, and layout. |
| 2. Boundary & Corner | 15 | Exercises extreme values (0, negatives, large strings, 0% rake, 100% rake, missing default values). |
| 3. Cross-Feature | 3 | Checks resetting and interaction transitions when switching between structures and mobile stacking layout adaptivity. |
| 4. Real-World Application | 5 | Runs complex tournament calculations (Turbo, Deepstack, High roller, winner-take-all) and full user journey. |
| **Total** | **38** | |

## Feature Checklist
| Feature | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---------|:------:|:------:|:------:|:------:|
| F1: Botón y Modal de Exploración Pública | 6 | 3 | ✓ | ✓ |
| F2: Visualización Detallada de Niveles/Descansos | 4 | 3 | ✓ | ✓ |
| F3: Simulador de Premios Interactivo | 5 | 9 | ✓ | ✓ |
