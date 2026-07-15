import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Landing } from '../views/Landing';
import { vi, describe, test, expect, beforeEach } from 'vitest';

const mockBlindStructures = [
  {
    id: 'struct-challenger',
    name: 'Challenger Verification Structure',
    organizer_id: 'org-challenger',
    levels: {
      levels: [
        { level: 1, small_blind: 100, big_blind: 200, ante: 0, duration: 15, is_break: false }
      ],
      defaults: {
        buy_in: 10000,
        rake: 3000,
        payout_structure: [50, 30, 20]
      }
    },
    created_at: '2026-07-15T00:00:00Z'
  }
];

let mockSelectResult: any = { data: mockBlindStructures, error: null };
let mockSingleResult: any = { data: null, error: null };

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

describe('Challenger 1 Empirical Verification Tests', () => {
  beforeEach(() => {
    mockSelectResult = { data: mockBlindStructures, error: null };
    mockSingleResult = { data: null, error: null };
    vi.clearAllMocks();
  });

  test('CV-01: Massive Inputs Simulation (players = 1000000, buy-in = 1000000) does not crash and calculates correct values with es-CL format', async () => {
    render(<Landing />);
    const exploreBtn = screen.getByTestId('btn-explorar-estructuras');
    fireEvent.click(exploreBtn);

    await waitFor(() => {
      expect(screen.getByTestId('structure-item-struct-challenger')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('structure-item-struct-challenger'));

    await waitFor(() => {
      expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
    });

    const playersInput = screen.getByTestId('sim-players-input');
    const buyinInput = screen.getByTestId('sim-buyin-input');

    // Massive values
    fireEvent.change(playersInput, { target: { value: '1000000' } });
    fireEvent.change(buyinInput, { target: { value: '1000000' } });

    // Expect gross pool: 1,000,000 * 1,000,000 = 1,000,000,000,000 (1 trillion)
    // Rake per player is min(buy_in, default_rake) = min(1000000, 3000) = 3000
    // Rake deduction: 1,000,000 * 3,000 = 3,000,000,000 (3 billion)
    // Net pool: 997,000,000,000 (997 billion)
    
    const grossOutput = screen.getByTestId('sim-gross-pool');
    const rakeOutput = screen.getByTestId('sim-rake-deduction');
    const netOutput = screen.getByTestId('sim-net-pool');

    // With es-CL locale, periods are thousands separators. e.g. 1.000.000.000.000
    expect(grossOutput.textContent).toBe('1.000.000.000.000');
    expect(rakeOutput.textContent).toBe('3.000.000.000');
    expect(netOutput.textContent).toBe('997.000.000.000');

    // Payout payouts verification
    // 1st prize (50%): 498.500.000.000
    // 2nd prize (30%): 299.100.000.000
    // 3rd prize (20%): 199.400.000.000
    expect(screen.getByTestId('prize-row-1').textContent).toContain('498.500.000.000');
    expect(screen.getByTestId('prize-row-2').textContent).toContain('299.100.000.000');
    expect(screen.getByTestId('prize-row-3').textContent).toContain('199.400.000.000');
  });

  test('CV-02: Float inputs rounding verification', async () => {
    render(<Landing />);
    const exploreBtn = screen.getByTestId('btn-explorar-estructuras');
    fireEvent.click(exploreBtn);

    await waitFor(() => {
      expect(screen.getByTestId('structure-item-struct-challenger')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('structure-item-struct-challenger'));

    await waitFor(() => {
      expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
    });

    const playersInput = screen.getByTestId('sim-players-input');
    const buyinInput = screen.getByTestId('sim-buyin-input');

    // Test float players (should round to nearest integer)
    // 10.4 should round to 10
    fireEvent.change(playersInput, { target: { value: '10.4' } });
    expect(playersInput).toHaveValue(10);

    // 10.6 should round to 11
    fireEvent.change(playersInput, { target: { value: '10.6' } });
    expect(playersInput).toHaveValue(11);

    // Float buy-in: 10000.75 (buy-in can be decimal, does not round to integer in state/input, but is rounded in formatAmount)
    fireEvent.change(buyinInput, { target: { value: '10000.75' } });
    expect(buyinInput).toHaveValue(10000.75);

    // With 11 players, 10000.75 buy-in, 3000 rake:
    // Gross: 11 * 10000.75 = 110008.25
    // Rake deduction: 11 * 3000 = 33000
    // Net: 110008.25 - 33000 = 77008.25
    // formatAmount rounds using Math.round, so:
    // Gross display: 110.008
    // Rake display: 33.000
    // Net display: 77.008
    const grossOutput = screen.getByTestId('sim-gross-pool');
    const rakeOutput = screen.getByTestId('sim-rake-deduction');
    const netOutput = screen.getByTestId('sim-net-pool');

    expect(grossOutput.textContent).toBe('110.008');
    expect(rakeOutput.textContent).toBe('33.000');
    expect(netOutput.textContent).toBe('77.008');

    // Prizes:
    // 1st (50%): 77008.25 * 0.5 = 38504.125 => Math.round is 38504
    // 2nd (30%): 77008.25 * 0.3 = 23102.475 => Math.round is 23102
    // 3rd (20%): 77008.25 * 0.2 = 15401.65 => Math.round is 15402
    expect(screen.getByTestId('prize-row-1').textContent).toContain('38.504');
    expect(screen.getByTestId('prize-row-2').textContent).toContain('23.102');
    expect(screen.getByTestId('prize-row-3').textContent).toContain('15.402');
  });

  test('CV-03: Boundary checks (Negative values are handled gracefully)', async () => {
    render(<Landing />);
    const exploreBtn = screen.getByTestId('btn-explorar-estructuras');
    fireEvent.click(exploreBtn);

    await waitFor(() => {
      expect(screen.getByTestId('structure-item-struct-challenger')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('structure-item-struct-challenger'));

    await waitFor(() => {
      expect(screen.getByTestId('sim-players-input')).toBeInTheDocument();
    });

    const playersInput = screen.getByTestId('sim-players-input');
    const buyinInput = screen.getByTestId('sim-buyin-input');

    // Negative players should be capped to 0
    fireEvent.change(playersInput, { target: { value: '-5' } });
    expect(playersInput).toHaveValue(0);

    // Negative buy-in should be capped to 0
    fireEvent.change(buyinInput, { target: { value: '-2500' } });
    expect(buyinInput).toHaveValue(0);
  });
});
