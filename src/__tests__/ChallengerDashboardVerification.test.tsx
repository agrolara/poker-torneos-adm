import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from '../views/Dashboard';
import { vi, describe, test, expect, beforeEach } from 'vitest';

// Setup mutable mock data arrays
let mockTournaments: any[] = [];
let mockPlayersCount = 0;
let mockTournamentPlayers: any[] = [];
let mockChampionships: any[] = [];

// Track state for the query chain
let currentTable = '';
let isCountQuery = false;

vi.mock('../supabaseClient', () => {
  const mockChain = {
    select: vi.fn().mockImplementation((_projection, options) => {
      isCountQuery = !!(options && options.count);
      return mockChain;
    }),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(() => {
      let data = null;
      if (currentTable === 'championships') {
        data = mockChampionships.find(c => c.status === 'active') || null;
      }
      return Promise.resolve({ data, error: null });
    }),
    single: vi.fn().mockImplementation(() => {
      let data = null;
      if (currentTable === 'championships') {
        data = mockChampionships.find(c => c.status === 'active') || null;
      }
      return Promise.resolve({ data, error: null });
    }),
    then: vi.fn().mockImplementation((onfulfilled) => {
      let result: any = { data: [], error: null };
      if (isCountQuery) {
        result = { count: mockPlayersCount, data: null, error: null };
      } else if (currentTable === 'tournaments') {
        result = { data: mockTournaments, error: null };
      } else if (currentTable === 'tournament_players') {
        result = { data: mockTournamentPlayers, error: null };
      } else if (currentTable === 'championships') {
        result = { data: mockChampionships, error: null };
      }
      return Promise.resolve(result).then(onfulfilled);
    })
  };

  return {
    supabase: {
      from: vi.fn().mockImplementation((table) => {
        currentTable = table;
        isCountQuery = false;
        return mockChain;
      }),
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: 'user-123' } } }, error: null })),
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
      user: { id: 'user-123', email: 'test@example.com' },
      profile: { id: 'user-123', name: 'Test User', is_super_admin: false },
      loading: false
    })
  };
});

describe('Challenger Dashboard Verification Tests', () => {
  beforeEach(() => {
    mockTournaments = [];
    mockPlayersCount = 0;
    mockTournamentPlayers = [];
    mockChampionships = [];
    currentTable = '';
    isCountQuery = false;
    vi.clearAllMocks();
  });

  test('CDV-01: Extreme inputs (1,000 tournaments, massive currency values) does not crash and renders correctly formatted values', async () => {
    // Mock 1,000 tournaments with large rake amount and buy-ins
    const count = 1000;
    mockTournaments = Array.from({ length: count }, (_, i) => ({
      id: `t-${i}`,
      name: `Tournament ${i}`,
      status: 'completed',
      buy_in_amount: 1000000000, // 1 billion buy-in
      rake_amount: 500000000,     // 500 million rake
      created_at: new Date(2026, 0, i + 1).toISOString(),
      championship_id: 'champ-active'
    }));

    // Mock 10 players for each of the 1,000 tournaments (10,000 players total in history)
    mockPlayersCount = 10000;

    // Simulate huge payout amounts
    // Each tournament has 2 players with payouts: 1st place wins 6 billion, 2nd place wins 4 billion.
    // Total prize pool = 1,000 * 10 billion = 10 trillion.
    // Total rake = 1,000 * 10 players * 500 million = 5 trillion.
    mockTournamentPlayers = [];
    for (let i = 0; i < count; i++) {
      mockTournamentPlayers.push(
        { tournament_id: `t-${i}`, player_id: 'p-1', guest_name: null, rebuys_count: 10, has_add_on: true, elimination_position: 1, payout_amount: 6000000000, player: { name: 'Super Player 1' } },
        { tournament_id: `t-${i}`, player_id: 'p-2', guest_name: null, rebuys_count: 5, has_add_on: false, elimination_position: 2, payout_amount: 4000000000, player: { name: 'Super Player 2' } }
      );
      // Add other players with 0 payouts
      for (let p = 3; p <= 10; p++) {
        mockTournamentPlayers.push({
          tournament_id: `t-${i}`,
          player_id: `p-${p}`,
          guest_name: null,
          rebuys_count: 2,
          has_add_on: false,
          elimination_position: p,
          payout_amount: 0,
          player: { name: `Super Player ${p}` }
        });
      }
    }

    mockChampionships = [
      { id: 'champ-active', name: 'Super Championship', status: 'active', created_at: '2026-01-01T00:00:00Z' }
    ];

    render(<Dashboard onNavigate={vi.fn()} />);

    // Assert that the page loaded successfully without throwing or overflowing into Infinity/NaN
    await waitFor(() => {
      expect(screen.getByText('Premios Distribuidos')).toBeInTheDocument();
    });

    // Check Premios Distribuidos: 1,000 * 10,000,000,000 = 10,000,000,000,000 (10 Trillion)
    // CLP formatting should be "$10.000.000.000.000" or similar
    const totalPrizeText = screen.getByText(/\$10\.000\.000\.000\.000/);
    expect(totalPrizeText).toBeInTheDocument();

    // Check Rake de Liga Acumulado: 1,000 * 10 players * 500,000,000 = 5,000,000,000,000 (5 Trillion)
    // CLP formatting should be "$5.000.000.000.000"
    const totalRakeText = screen.getByText(/\$5\.000\.000\.000\.000/);
    expect(totalRakeText).toBeInTheDocument();

    // Check Promedio de Recompras:
    // 10 players per tourney. p-1 has 10 rebuys. p-2 has 5 rebuys. p-3 to p-10 (8 players) have 2 rebuys each (16 rebuys total).
    // Total rebuys per tourney = 10 + 5 + 16 = 31 rebuys.
    // Total players per tourney = 10.
    // Average = 3.1
    expect(screen.getByText('3.1 recompras')).toBeInTheDocument();
  });

  test('CDV-02: Chronological Trend Logic Verification (Single tournament vs Multiple tournaments)', async () => {
    mockChampionships = [
      { id: 'champ-active', name: 'Liga Invierno', status: 'active', created_at: '2026-07-01T00:00:00Z' }
    ];

    // Case A: 1 completed tournament (K = 1) -> Trend should be ●
    mockTournaments = [
      {
        id: 't-1',
        name: 'Fecha 1',
        status: 'completed',
        buy_in_amount: 10000,
        rake_amount: 2000,
        created_at: '2026-07-01T12:00:00Z',
        championship_id: 'champ-active'
      }
    ];
    mockTournamentPlayers = [
      { tournament_id: 't-1', player_id: 'p-1', guest_name: null, rebuys_count: 0, has_add_on: false, elimination_position: 1, payout_amount: 0, player: { name: 'Player A' } },
      { tournament_id: 't-1', player_id: 'p-2', guest_name: null, rebuys_count: 0, has_add_on: false, elimination_position: 2, payout_amount: 0, player: { name: 'Player B' } }
    ];

    const { rerender } = render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Player A')).toBeInTheDocument();
    });

    // Check trends for K = 1: Should be ●
    let rowA = screen.getByText('Player A').closest('tr');
    expect(rowA?.textContent).toContain('●');
    let rowB = screen.getByText('Player B').closest('tr');
    expect(rowB?.textContent).toContain('●');

    // Case B: 2 completed tournaments (K = 2) -> Trend updates based on ranking change
    // Chronologically: t-1 (oldest), then t-2 (newest)
    mockTournaments = [
      {
        id: 't-2',
        name: 'Fecha 2',
        status: 'completed',
        buy_in_amount: 10000,
        rake_amount: 2000,
        created_at: '2026-07-02T12:00:00Z',
        championship_id: 'champ-active'
      },
      {
        id: 't-1',
        name: 'Fecha 1',
        status: 'completed',
        buy_in_amount: 10000,
        rake_amount: 2000,
        created_at: '2026-07-01T12:00:00Z',
        championship_id: 'champ-active'
      }
    ];

    // Standings calculation details:
    // After T1 (N = 3 players):
    // Player A (1st): points = (3-1+1)*10 + 50 = 80. Rank 1
    // Player B (2nd): points = (3-2+1)*10 + 30 = 50. Rank 2
    // Player C (3rd): points = (3-3+1)*10 + 20 = 30. Rank 3
    //
    // After T2 (N = 3 players):
    // Player B (1st): points in T2 = 80. Total points = 50 + 80 = 130. Rank 1 (rose from 2 to 1). Trend: ▲
    // Player A (2nd): points in T2 = 50. Total points = 80 + 50 = 130. Rank 1 or 2? Let's check tie-breaker.
    // Wait, let's make Player B clearly win to avoid tie:
    // Let's give Player B 2 rebuys in T2: rebuys_count: 2 (adds 4 pts) => total points = 134. Rank 1.
    // Player A: total points = 130. Rank 2 (fell from 1 to 2). Trend: ▼
    // Player C (3rd): points in T2 = 30. Total points = 30 + 30 = 60. Rank 3. Trend: ●
    // Player D (did not play T1, plays T2 and comes in 3rd in T2):
    // Points in T2 = (3-3+1)*10 + 20 = 30. Rank 4 (since Player C has 60).
    // In prevStandings, Player D was not present. Trend: ▲
    mockTournamentPlayers = [
      // Tournament 1
      { tournament_id: 't-1', player_id: 'p-1', guest_name: null, rebuys_count: 0, has_add_on: false, elimination_position: 1, payout_amount: 0, player: { name: 'Player A' } },
      { tournament_id: 't-1', player_id: 'p-2', guest_name: null, rebuys_count: 0, has_add_on: false, elimination_position: 2, payout_amount: 0, player: { name: 'Player B' } },
      { tournament_id: 't-1', player_id: 'p-3', guest_name: null, rebuys_count: 0, has_add_on: false, elimination_position: 3, payout_amount: 0, player: { name: 'Player C' } },

      // Tournament 2
      { tournament_id: 't-2', player_id: 'p-2', guest_name: null, rebuys_count: 2, has_add_on: false, elimination_position: 1, payout_amount: 0, player: { name: 'Player B' } },
      { tournament_id: 't-2', player_id: 'p-1', guest_name: null, rebuys_count: 0, has_add_on: false, elimination_position: 2, payout_amount: 0, player: { name: 'Player A' } },
      { tournament_id: 't-2', player_id: 'p-3', guest_name: null, rebuys_count: 0, has_add_on: false, elimination_position: 3, payout_amount: 0, player: { name: 'Player C' } },
      { tournament_id: 't-2', player_id: 'p-4', guest_name: null, rebuys_count: 0, has_add_on: false, elimination_position: 4, payout_amount: 0, player: { name: 'Player D' } }
    ];

    rerender(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Player B')).toBeInTheDocument();
    });

    const rowA2 = screen.getByText('Player A').closest('tr');
    expect(rowA2?.textContent).toContain('▼'); // Fell from 1 to 2

    const rowB2 = screen.getByText('Player B').closest('tr');
    expect(rowB2?.textContent).toContain('▲'); // Rose from 2 to 1

    const rowC = screen.getByText('Player C').closest('tr');
    expect(rowC?.textContent).toContain('●'); // Maintained rank 3

    // Player D should have trend ▲ because they were not in prevStandings
    const rowD = screen.getByText('Player D').closest('tr');
    expect(rowD?.textContent).toContain('▲');
  });
});
