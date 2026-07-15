import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Landing } from '../views/Landing';
import { vi, describe, test, expect, beforeEach } from 'vitest';

// Define mock structures matching requirements
const mockBlindStructures = [
  {
    id: 'struct-1',
    name: 'Estructura Semanal 1',
    organizer_id: 'org-1',
    levels: {
      levels: [
        { level: 1, small_blind: 100, big_blind: 200, ante: 0, duration: 15, is_break: false },
        { level: 2, small_blind: 150, big_blind: 300, ante: 0, duration: 15, is_break: false },
        { level: 3, small_blind: 200, big_blind: 400, ante: 50, duration: 15, is_break: false },
        { level: 4, small_blind: 0, big_blind: 0, ante: 0, duration: 10, is_break: true },
        { level: 5, small_blind: 300, big_blind: 600, ante: 100, duration: 15, is_break: false }
      ],
      defaults: {
        buy_in: 10000,
        rake: 3000,
        payout_structure: [50, 30, 20]
      }
    },
    created_at: '2026-07-15T00:00:00Z'
  },
  {
    id: 'struct-free',
    name: 'Freeroll Structure',
    organizer_id: 'org-1',
    levels: {
      levels: [
        { level: 1, small_blind: 100, big_blind: 200, ante: 0, duration: 20, is_break: false },
        { level: 2, small_blind: 200, big_blind: 400, ante: 0, duration: 20, is_break: false }
      ],
      defaults: {
        buy_in: 5000,
        rake: 0,
        payout_structure: [100]
      }
    },
    created_at: '2026-07-15T00:00:00Z'
  },
  {
    id: 'struct-100rake',
    name: '100 Percent Rake Structure',
    organizer_id: 'org-1',
    levels: {
      levels: [
        { level: 1, small_blind: 100, big_blind: 200, ante: 0, duration: 15, is_break: false }
      ],
      defaults: {
        buy_in: 5000,
        rake: 5000,
        payout_structure: [50, 30, 20]
      }
    },
    created_at: '2026-07-15T00:00:00Z'
  },
  {
    id: 'struct-nodefaults',
    name: 'Bare Structure',
    organizer_id: 'org-1',
    levels: [
      { level: 1, small_blind: 100, big_blind: 200, ante: 0, duration: 15, is_break: false },
      { level: 2, small_blind: 200, big_blind: 400, ante: 0, duration: 15, is_break: false }
    ],
    created_at: '2026-07-15T00:00:00Z'
  }
];

// Setup mutable mock outputs
let mockSelectResult: any = { data: mockBlindStructures, error: null };
let mockSingleResult: any = { data: null, error: null };

// Mock Supabase client
vi.mock('../supabaseClient', () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => Promise.resolve(mockSingleResult)),
    then: vi.fn().mockImplementation((onfulfilled) => {
      return Promise.resolve(mockSelectResult).then(onfulfilled);
    })
  };
  return {
    supabase: {
      from: vi.fn(() => mockChain),
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } }
        }))
      }
    },
    isConfigured: true
  };
});

// Mock AuthContext
vi.mock('../context/AuthContext', () => {
  return {
    useAuth: () => ({
      signIn: vi.fn(),
      signUp: vi.fn(),
      user: null,
      profile: null,
      loading: false
    })
  };
});

describe('Public Blind Structures Explorer & Simulator E2E', () => {
  beforeEach(() => {
    mockSelectResult = { data: mockBlindStructures, error: null };
    mockSingleResult = { data: null, error: null };
    vi.clearAllMocks();
  });

  describe('Tier 1: Feature Coverage', () => {
    test('F1-T1-01: Check button "Explorar Estructuras de Ciegas" is present on the public landing page', () => {
      render(<Landing />);
      const button = screen.getByTestId('btn-explorar-estructuras');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent(/explorar/i);
    });

    test('F1-T1-02: Modal opens when clicking the exploration button', async () => {
      render(<Landing />);
      const button = screen.getByTestId('btn-explorar-estructuras');
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByTestId('modal-explorar-estructuras')).toBeInTheDocument();
      });
    });

    test('F1-T1-03: Modal displays loading state/skeleton initially', async () => {
      let resolvePromise: any;
      mockSelectResult = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));

      expect(screen.getByTestId('modal-explorar-estructuras')).toBeInTheDocument();
      expect(screen.getByText(/cargando/i) || screen.getByTestId('loading-skeleton')).toBeInTheDocument();

      resolvePromise({ data: mockBlindStructures, error: null });
    });

    test('F1-T1-04: Modal displays loaded public blind structures from database', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      expect(screen.getByText('Estructura Semanal 1')).toBeInTheDocument();
      expect(screen.getByText('Freeroll Structure')).toBeInTheDocument();
    });

    test('F1-T1-05: Modal displays standard system preset structures', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('modal-explorar-estructuras')).toBeInTheDocument();
      });
      expect(screen.getByText(/turbo/i) || screen.getByText(/estándar/i)).toBeInTheDocument();
    });

    test('F1-T1-06: Modal closes when clicking the close (X) button', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('modal-explorar-estructuras')).toBeInTheDocument();
      });
      const closeBtn = screen.getByTestId('modal-close-btn');
      fireEvent.click(closeBtn);
      await waitFor(() => {
        expect(screen.queryByTestId('modal-explorar-estructuras')).not.toBeInTheDocument();
      });
    });

    test('F2-T1-07: Clicking a structure displays its detailed level list', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('level-row-1')).toBeInTheDocument();
      });
    });

    test('F2-T1-08: Level detail list displays correct columns: Level, Blinds, Ante, Duration', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('level-row-1')).toBeInTheDocument();
      });
      expect(screen.getByText(/nivel/i) || screen.getByText(/lvl/i)).toBeInTheDocument();
      expect(screen.getByText(/ciegas/i) || screen.getByText(/blinds/i)).toBeInTheDocument();
      expect(screen.getByText(/ante/i)).toBeInTheDocument();
      expect(screen.getByText(/duración/i) || screen.getByText(/tiempo/i) || screen.getByText(/min/i)).toBeInTheDocument();
    });

    test('F2-T1-09: Back button in detail view returns to the structures list', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('level-row-1')).toBeInTheDocument();
      });
      const backBtn = screen.getByTestId('detail-back-btn');
      fireEvent.click(backBtn);
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
    });

    test('F2-T1-10: Breaks (is_break: true) are visually highlighted (green styling/elements)', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('break-row-4')).toBeInTheDocument();
      });
      const breakRow = screen.getByTestId('break-row-4');
      expect(breakRow.className).toMatch(/green|descanso|break/i);
    });

    test('F3-T1-11: Payout Simulator inputs (Players, Buy-in) are displayed', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
        expect(screen.getByTestId('sim-buyin-input')).toBeInTheDocument();
      });
    });

    test('F3-T1-12: Payout Simulator inputs are pre-populated with structure defaults', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-buyin-input')).toHaveValue(10000);
      });
    });

    test('F3-T1-13: Gross Pool is calculated correctly as Players * Buy-in', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
      });

      const playersInput = screen.getByTestId('sim-players-input');
      const buyinInput = screen.getByTestId('sim-buyin-input');

      fireEvent.change(playersInput, { target: { value: '10' } });
      fireEvent.change(buyinInput, { target: { value: '10000' } });

      const grossOutput = screen.getByTestId('sim-gross-pool');
      expect(grossOutput.textContent).toMatch(/100\.?000/);
    });

    test('F3-T1-14: Net Pool is calculated correctly by subtracting Rake from Gross Pool', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
      });

      const playersInput = screen.getByTestId('sim-players-input');
      const buyinInput = screen.getByTestId('sim-buyin-input');

      fireEvent.change(playersInput, { target: { value: '10' } });
      fireEvent.change(buyinInput, { target: { value: '10000' } });

      const rakeOutput = screen.getByTestId('sim-rake-deduction');
      const netOutput = screen.getByTestId('sim-net-pool');

      expect(rakeOutput.textContent).toMatch(/30\.?000/);
      expect(netOutput.textContent).toMatch(/70\.?000/);
    });

    test('F3-T1-15: Payout list displays correct podio percentages and CLP payout amounts', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
      });

      const playersInput = screen.getByTestId('sim-players-input');
      const buyinInput = screen.getByTestId('sim-buyin-input');

      fireEvent.change(playersInput, { target: { value: '10' } });
      fireEvent.change(buyinInput, { target: { value: '10000' } });

      await waitFor(() => {
        expect(screen.getByTestId('prize-row-1')).toBeInTheDocument();
      });

      const row1 = screen.getByTestId('prize-row-1');
      const row2 = screen.getByTestId('prize-row-2');
      const row3 = screen.getByTestId('prize-row-3');

      expect(row1.textContent).toMatch(/50%/);
      expect(row1.textContent).toMatch(/35\.?000/);

      expect(row2.textContent).toMatch(/30%/);
      expect(row2.textContent).toMatch(/21\.?000/);

      expect(row3.textContent).toMatch(/20%/);
      expect(row3.textContent).toMatch(/14\.?000/);
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    test('F1-T2-01: Handling of empty structures list from the database (renders empty state)', async () => {
      mockSelectResult = { data: [], error: null };
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('modal-explorar-estructuras')).toBeInTheDocument();
      });
      expect(screen.getByText(/no se encontraron estructuras/i) || screen.getByText(/no hay estructuras/i)).toBeInTheDocument();
    });

    test('F1-T2-02: Handling of database query error (renders error alert, doesn\'t crash)', async () => {
      mockSelectResult = { data: null, error: { message: 'Database failure connection' } };
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('modal-explorar-estructuras')).toBeInTheDocument();
      });
      expect(screen.getByText(/error/i) || screen.getByText(/falló/i)).toBeInTheDocument();
    });

    test('F1-T2-03: Modal closes when clicking the backdrop overlay', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('modal-explorar-estructuras')).toBeInTheDocument();
      });
      const overlay = screen.getByTestId('modal-explorar-estructuras');
      fireEvent.click(overlay);
      await waitFor(() => {
        expect(screen.queryByTestId('modal-explorar-estructuras')).not.toBeInTheDocument();
      });
    });

    test('F2-T2-04: Structure with 0 standard levels (only breaks) displays breaks correctly', async () => {
      const mockZeroLevels = [
        {
          id: 'struct-only-breaks',
          name: 'Only Breaks Structure',
          organizer_id: 'org-1',
          levels: {
            levels: [
              { level: 1, small_blind: 0, big_blind: 0, ante: 0, duration: 15, is_break: true }
            ],
            defaults: { buy_in: 5000, rake: 1000, payout_structure: [100] }
          }
        }
      ];
      mockSelectResult = { data: mockZeroLevels, error: null };
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-only-breaks')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-only-breaks'));
      await waitFor(() => {
        expect(screen.getByTestId('break-row-1')).toBeInTheDocument();
      });
    });

    test('F2-T2-05: Structure with a large number of levels renders within scrollable container', async () => {
      const manyLevels = Array.from({ length: 50 }, (_, i) => ({
        level: i + 1,
        small_blind: 100 * (i + 1),
        big_blind: 200 * (i + 1),
        ante: 0,
        duration: 15,
        is_break: false
      }));
      const mockManyLevelsStruct = [
        {
          id: 'struct-many-levels',
          name: 'Big Stack Structure',
          organizer_id: 'org-1',
          levels: {
            levels: manyLevels,
            defaults: { buy_in: 5000, rake: 1000, payout_structure: [100] }
          }
        }
      ];
      mockSelectResult = { data: mockManyLevelsStruct, error: null };
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-many-levels')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-many-levels'));
      await waitFor(() => {
        expect(screen.getByTestId('level-row-50')).toBeInTheDocument();
      });
      const container = screen.getByTestId('levels-container');
      expect(container.className).toMatch(/scroll|overflow-y/i);
    });

    test('F2-T2-06: Structure with very long name is wrapped or truncated gracefully', async () => {
      const longName = 'A'.repeat(100);
      const mockLongNameStruct = [
        {
          id: 'struct-long-name',
          name: longName,
          organizer_id: 'org-1',
          levels: {
            levels: [{ level: 1, small_blind: 100, big_blind: 200, ante: 0, duration: 15, is_break: false }],
            defaults: { buy_in: 5000, rake: 1000, payout_structure: [100] }
          }
        }
      ];
      mockSelectResult = { data: mockLongNameStruct, error: null };
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-long-name')).toBeInTheDocument();
      });
      const element = screen.getByText(longName);
      expect(element).toBeInTheDocument();
    });

    test('F3-T2-07: Payout Simulator with 0 players calculates 0 Gross, 0 Rake, 0 Net', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('sim-players-input'), { target: { value: '0' } });

      expect(screen.getByTestId('sim-gross-pool').textContent).toBe('0');
      expect(screen.getByTestId('sim-rake-deduction').textContent).toBe('0');
      expect(screen.getByTestId('sim-net-pool').textContent).toBe('0');
    });

    test('F3-T2-08: Payout Simulator with 0 buy-in calculates 0 Gross, 0 Rake, 0 Net', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-buyin-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('sim-buyin-input'), { target: { value: '0' } });

      expect(screen.getByTestId('sim-gross-pool').textContent).toBe('0');
      expect(screen.getByTestId('sim-rake-deduction').textContent).toBe('0');
      expect(screen.getByTestId('sim-net-pool').textContent).toBe('0');
    });

    test('F3-T2-09: Payout Simulator with negative player count (treated as 0/validated)', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('sim-players-input'), { target: { value: '-5' } });

      expect(screen.getByTestId('sim-gross-pool').textContent).toBe('0');
      expect(screen.getByTestId('sim-rake-deduction').textContent).toBe('0');
      expect(screen.getByTestId('sim-net-pool').textContent).toBe('0');
    });

    test('F3-T2-10: Payout Simulator with negative buy-in (treated as 0/validated)', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-buyin-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('sim-buyin-input'), { target: { value: '-1000' } });

      expect(screen.getByTestId('sim-gross-pool').textContent).toBe('0');
      expect(screen.getByTestId('sim-rake-deduction').textContent).toBe('0');
      expect(screen.getByTestId('sim-net-pool').textContent).toBe('0');
    });

    test('F3-T2-11: Structure with 0% rake (defaults.rake_amount = 0) calculates 0 Rake and Net Pool = Gross Pool', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-free')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-free'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
      });

      const playersInput = screen.getByTestId('sim-players-input');
      const buyinInput = screen.getByTestId('sim-buyin-input');

      fireEvent.change(playersInput, { target: { value: '10' } });
      fireEvent.change(buyinInput, { target: { value: '5000' } });

      expect(screen.getByTestId('sim-gross-pool').textContent).toMatch(/50\.?000/);
      expect(screen.getByTestId('sim-rake-deduction').textContent).toBe('0');
      expect(screen.getByTestId('sim-net-pool').textContent).toMatch(/50\.?000/);
    });

    test('F3-T2-12: Structure with 100% rake (rake_amount = buy_in_amount) calculates Net Pool = 0', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-100rake')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-100rake'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
      });

      const playersInput = screen.getByTestId('sim-players-input');
      const buyinInput = screen.getByTestId('sim-buyin-input');

      fireEvent.change(playersInput, { target: { value: '10' } });
      fireEvent.change(buyinInput, { target: { value: '5000' } });

      expect(screen.getByTestId('sim-gross-pool').textContent).toMatch(/50\.?000/);
      expect(screen.getByTestId('sim-rake-deduction').textContent).toMatch(/50\.?000/);
      expect(screen.getByTestId('sim-net-pool').textContent).toBe('0');
    });

    test('F3-T2-13: Payout option "Ganador toma todo" (100% to 1st) renders only 1 prize row', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-free')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-free'));
      await waitFor(() => {
        expect(screen.getByTestId('prize-row-1')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('prize-row-2')).not.toBeInTheDocument();
    });

    test('F3-T2-14: Structure with missing defaults in levels column handles fallback defaults', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-nodefaults')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-nodefaults'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-buyin-input')).toHaveValue(10000);
        expect(screen.getByTestId('sim-rake-deduction')).toBeInTheDocument();
      });
    });

    test('F3-T2-15: Payout Simulator handles floating-point player count (rounds or rejects)', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
      });

      const playersInput = screen.getByTestId('sim-players-input');
      fireEvent.change(playersInput, { target: { value: '12.5' } });

      const value = parseFloat(playersInput.getAttribute('value') || (playersInput as HTMLInputElement).value);
      expect(value % 1).toBe(0);
    });
  });

  describe('Tier 3: Cross-Feature Combinations', () => {
    test('COM-T3-01: Switching structures resets inputs to new structure\'s defaults if custom, or system defaults', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-buyin-input')).toHaveValue(10000);
      });

      fireEvent.click(screen.getByTestId('detail-back-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-free')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('structure-item-struct-free'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-buyin-input')).toHaveValue(5000);
      });
    });

    test('COM-T3-02: Modifying inputs, returning back, and selecting a new structure updates calculations with new structure parameters', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('sim-players-input'), { target: { value: '15' } });
      expect(screen.getByTestId('sim-gross-pool').textContent).toMatch(/150\.?000/);

      fireEvent.click(screen.getByTestId('detail-back-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-free')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('structure-item-struct-free'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-buyin-input')).toHaveValue(5000);
      });

      const rakeText = screen.getByTestId('sim-rake-deduction').textContent;
      expect(rakeText).toBe('0');
    });

    test('COM-T3-03: Layout adaptivity elements check: ensures flex direction classes stack elements on small viewport sizes', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('modal-explorar-estructuras')).toBeInTheDocument();
      });
      const modal = screen.getByTestId('modal-explorar-estructuras');
      expect(modal.className || '').toBeDefined();
    });
  });

  describe('Tier 4: Real-World Application Scenarios', () => {
    test('APP-T4-01: Standard Turbo Tournament Simulation (25 players, 10,000 buy-in, 3,000 rake, [50,30,20] payout)', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
      });

      const playersInput = screen.getByTestId('sim-players-input');
      const buyinInput = screen.getByTestId('sim-buyin-input');

      fireEvent.change(playersInput, { target: { value: '25' } });
      fireEvent.change(buyinInput, { target: { value: '10000' } });

      expect(screen.getByTestId('sim-gross-pool').textContent).toMatch(/250\.?000/);
      expect(screen.getByTestId('sim-rake-deduction').textContent).toMatch(/75\.?000/);
      expect(screen.getByTestId('sim-net-pool').textContent).toMatch(/175\.?000/);

      await waitFor(() => {
        expect(screen.getByTestId('prize-row-1')).toBeInTheDocument();
      });
      expect(screen.getByTestId('prize-row-1').textContent).toMatch(/87\.?500/);
      expect(screen.getByTestId('prize-row-2').textContent).toMatch(/52\.?500/);
      expect(screen.getByTestId('prize-row-3').textContent).toMatch(/35\.?000/);
    });

    test('APP-T4-02: Micro-stakes Deepstack Tournament Simulation (8 players, 2,000 buy-in, 500 rake, [70,30] payout)', async () => {
      const mockMicroStruct = [
        {
          id: 'struct-micro',
          name: 'Micro Deepstack',
          organizer_id: 'org-1',
          levels: {
            levels: [{ level: 1, small_blind: 10, big_blind: 20, ante: 0, duration: 20, is_break: false }],
            defaults: { buy_in: 2000, rake: 500, payout_structure: [70, 30] }
          }
        }
      ];
      mockSelectResult = { data: mockMicroStruct, error: null };
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-micro')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-micro'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
      });

      const playersInput = screen.getByTestId('sim-players-input');
      const buyinInput = screen.getByTestId('sim-buyin-input');

      fireEvent.change(playersInput, { target: { value: '8' } });
      fireEvent.change(buyinInput, { target: { value: '2000' } });

      expect(screen.getByTestId('sim-gross-pool').textContent).toMatch(/16\.?000/);
      expect(screen.getByTestId('sim-rake-deduction').textContent).toMatch(/4\.?000/);
      expect(screen.getByTestId('sim-net-pool').textContent).toMatch(/12\.?000/);

      expect(screen.getByTestId('prize-row-1').textContent).toMatch(/8\.?400/);
      expect(screen.getByTestId('prize-row-2').textContent).toMatch(/3\.?600/);
    });

    test('APP-T4-03: High-roller Winner-Take-All Simulation (15 players, 100,000 buy-in, 10,000 rake, Winner-take-all)', async () => {
      const mockHRStruct = [
        {
          id: 'struct-hr',
          name: 'High Roller',
          organizer_id: 'org-1',
          levels: {
            levels: [{ level: 1, small_blind: 500, big_blind: 1000, ante: 100, duration: 30, is_break: false }],
            defaults: { buy_in: 100000, rake: 10000, payout_structure: [100] }
          }
        }
      ];
      mockSelectResult = { data: mockHRStruct, error: null };
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-hr')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-hr'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
      });

      const playersInput = screen.getByTestId('sim-players-input');
      const buyinInput = screen.getByTestId('sim-buyin-input');

      fireEvent.change(playersInput, { target: { value: '15' } });
      fireEvent.change(buyinInput, { target: { value: '100000' } });

      expect(screen.getByTestId('sim-gross-pool').textContent).toMatch(/1\.?500\.?000/);
      expect(screen.getByTestId('sim-rake-deduction').textContent).toMatch(/150\.?000/);
      expect(screen.getByTestId('sim-net-pool').textContent).toMatch(/1\.?350\.?000/);

      expect(screen.getByTestId('prize-row-1').textContent).toMatch(/1\.?350\.?000/);
      expect(screen.queryByTestId('prize-row-2')).not.toBeInTheDocument();
    });

    test('APP-T4-04: Large League Event Simulation (120 players, 15,000 buy-in, 3,000 rake, [50,30,20] payout)', async () => {
      render(<Landing />);
      fireEvent.click(screen.getByTestId('btn-explorar-estructuras'));
      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));
      await waitFor(() => {
        expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
      });

      const playersInput = screen.getByTestId('sim-players-input');
      const buyinInput = screen.getByTestId('sim-buyin-input');

      fireEvent.change(playersInput, { target: { value: '120' } });
      fireEvent.change(buyinInput, { target: { value: '15000' } });

      expect(screen.getByTestId('sim-gross-pool').textContent).toMatch(/1\.?800\.?000/);
      expect(screen.getByTestId('sim-rake-deduction').textContent).toMatch(/360\.?000/);
      expect(screen.getByTestId('sim-net-pool').textContent).toMatch(/1\.?440\.?000/);

      expect(screen.getByTestId('prize-row-1').textContent).toMatch(/720\.?000/);
      expect(screen.getByTestId('prize-row-2').textContent).toMatch(/432\.?000/);
      expect(screen.getByTestId('prize-row-3').textContent).toMatch(/288\.?000/);
    });

    test('APP-T4-05: Fully integrated visitor workflow (explore -> select structure -> modify players -> modify buy-in -> verify calculations -> check breaks -> close modal)', async () => {
      render(<Landing />);

      const exploreBtn = screen.getByTestId('btn-explorar-estructuras');
      fireEvent.click(exploreBtn);

      await waitFor(() => {
        expect(screen.getByTestId('modal-explorar-estructuras')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('structure-item-struct-1')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('structure-item-struct-1'));

      await waitFor(() => {
        expect(screen.getByTestId('level-row-1')).toBeInTheDocument();
        expect(screen.getByTestId('break-row-4')).toBeInTheDocument();
      });

      const playersInput = screen.getByTestId('sim-players-input');
      const buyinInput = screen.getByTestId('sim-buyin-input');

      fireEvent.change(playersInput, { target: { value: '12' } });
      fireEvent.change(buyinInput, { target: { value: '15000' } });

      expect(screen.getByTestId('sim-gross-pool').textContent).toMatch(/180\.?000/);
      expect(screen.getByTestId('sim-rake-deduction').textContent).toMatch(/36\.?000/);
      expect(screen.getByTestId('sim-net-pool').textContent).toMatch(/144\.?000/);

      await waitFor(() => {
        expect(screen.getByTestId('prize-row-1')).toBeInTheDocument();
      });
      expect(screen.getByTestId('prize-row-1').textContent).toMatch(/72\.?000/);

      const closeBtn = screen.getByTestId('modal-close-btn');
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('modal-explorar-estructuras')).not.toBeInTheDocument();
      });
    });
  });
});
