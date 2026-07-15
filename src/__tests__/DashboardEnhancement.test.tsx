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

describe('Dashboard Phase 2 Enhancements Tests', () => {
  beforeEach(() => {
    mockTournaments = [];
    mockPlayersCount = 0;
    mockTournamentPlayers = [];
    mockChampionships = [];
    currentTable = '';
    isCountQuery = false;
    vi.clearAllMocks();
  });

  test('R1: Financial KPIs cards display Premios Distribuidos, Rake de Liga Acumulado, and Promedio de Recompras', async () => {
    // T1: completed, buy_in: 10000, rake: 2000
    // T2: completed, buy_in: 20000, rake: 3000
    mockTournaments = [
      {
        id: 't-1',
        name: 'Torneo 1',
        status: 'completed',
        buy_in_amount: 10000,
        rake_amount: 2000,
        created_at: '2026-07-01T12:00:00Z',
        championship_id: 'champ-active'
      },
      {
        id: 't-2',
        name: 'Torneo 2',
        status: 'completed',
        buy_in_amount: 20000,
        rake_amount: 3000,
        created_at: '2026-07-02T12:00:00Z',
        championship_id: 'champ-active'
      }
    ];

    mockPlayersCount = 5;

    // T1: 3 players: A, B, C.
    // Rebuys: A=2, B=2, C=1. Payouts: A=50000, B=30000, C=0.
    // T2: 2 players: A, B.
    // Rebuys: A=1, B=0. Payouts: A=100000, B=0.
    mockTournamentPlayers = [
      { tournament_id: 't-1', player_id: 'p-a', guest_name: null, rebuys_count: 2, has_add_on: true, elimination_position: 1, payout_amount: 50000, player: { name: 'Player A' } },
      { tournament_id: 't-1', player_id: 'p-b', guest_name: null, rebuys_count: 2, has_add_on: false, elimination_position: 2, payout_amount: 30000, player: { name: 'Player B' } },
      { tournament_id: 't-1', player_id: 'p-c', guest_name: null, rebuys_count: 1, has_add_on: false, elimination_position: 3, payout_amount: 0, player: { name: 'Player C' } },
      
      { tournament_id: 't-2', player_id: 'p-a', guest_name: null, rebuys_count: 1, has_add_on: true, elimination_position: 1, payout_amount: 100000, player: { name: 'Player A' } },
      { tournament_id: 't-2', player_id: 'p-b', guest_name: null, rebuys_count: 0, has_add_on: false, elimination_position: 2, payout_amount: 0, player: { name: 'Player B' } }
    ];

    mockChampionships = [
      { id: 'champ-active', name: 'Liga Invierno', status: 'active', created_at: '2026-07-01T00:00:00Z' }
    ];

    render(<Dashboard onNavigate={vi.fn()} />);

    // R1 KPI Assertions
    // Premios Distribuidos: 50000 + 30000 + 100000 + 0 = 180000
    await waitFor(() => {
      expect(screen.getByText('Premios Distribuidos')).toBeInTheDocument();
    });
    expect(screen.getByText(/\$180\.?000/)).toBeInTheDocument();

    // Rake de Liga Acumulado: (3 players in T1 * 2000) + (2 players in T2 * 3000) = 6000 + 6000 = 12000
    expect(screen.getByText('Rake de Liga Acumulado')).toBeInTheDocument();
    expect(screen.getByText(/\$12\.?000/)).toBeInTheDocument();

    // Promedio de Recompras: 6 rebuys / 5 players = 1.2
    expect(screen.getByText('Promedio de Recompras')).toBeInTheDocument();
    expect(screen.getByText('1.2 recompras')).toBeInTheDocument();
  });

  test('R2: Completed Tournaments in Fechas de Campeonato show podium and stats', async () => {
    mockTournaments = [
      {
        id: 't-1',
        name: 'Fecha 1 de Campeonato',
        status: 'completed',
        buy_in_amount: 10000,
        rebuy_amount: 5000,
        add_on_amount: 3000,
        rake_amount: 2000,
        created_at: '2026-07-01T12:00:00Z',
        championship_id: 'champ-active',
        payout_structure: [50, 30, 20]
      }
    ];

    // 3 players:
    // A: 1st, 1 rebuy, 1 addon. buyin=10k, rebuy=5k, addon=3k. Total=18k. payout=22.5k
    // B: 2nd, 2 rebuys, 0 addon. buyin=10k, rebuy=10k, addon=0. Total=20k. payout=13.5k
    // C: 3rd, 0 rebuys, 1 addon. buyin=10k, rebuy=0, addon=3k. Total=13k. payout=9k
    // Financial calculations:
    // buyins total = 3 * 10000 = 30000
    // rebuys total = 3 * 5000 = 15000
    // addons total = 2 * 3000 = 6000
    // Recaudación total = 30000 + 15000 + 6000 = 51000
    // Rake recolectado = 3 * 2000 = 6000
    // Pozo neto repartido = Recaudación total - Rake recolectado = 45000 (which matches payouts 22.5k + 13.5k + 9k)
    mockTournamentPlayers = [
      { tournament_id: 't-1', player_id: 'p-a', guest_name: null, rebuys_count: 1, has_add_on: true, elimination_position: 1, payout_amount: 22500, player: { name: 'Player A' } },
      { tournament_id: 't-1', player_id: 'p-b', guest_name: null, rebuys_count: 2, has_add_on: false, elimination_position: 2, payout_amount: 13500, player: { name: 'Player B' } },
      { tournament_id: 't-1', player_id: 'p-c', guest_name: null, rebuys_count: 0, has_add_on: true, elimination_position: 3, payout_amount: 9000, player: { name: 'Player C' } }
    ];

    mockChampionships = [
      { id: 'champ-active', name: 'Liga Invierno', status: 'active', created_at: '2026-07-01T00:00:00Z' }
    ];

    render(<Dashboard onNavigate={vi.fn()} />);

    // Check mini-podium: 1st, 2nd, 3rd place names and emojis
    await waitFor(() => {
      expect(screen.getByText(/Player A/)).toBeInTheDocument();
    });
    expect(screen.getByText(/🥇/)).toBeInTheDocument();
    expect(screen.getByText(/🥈/)).toBeInTheDocument();
    expect(screen.getByText(/🥉/)).toBeInTheDocument();
    
    expect(screen.getByText(/Player B/)).toBeInTheDocument();
    expect(screen.getByText(/Player C/)).toBeInTheDocument();

    // Check tournament financial stats
    expect(screen.getByText(/Recaudación total:/i) || screen.getByText(/Recaudación:/i)).toBeInTheDocument();
    expect(screen.getByText(/\$51\.?000/)).toBeInTheDocument();

    expect(screen.getByText(/Rake recolectado:/i) || screen.getByText(/Rake:/i)).toBeInTheDocument();
    expect(screen.getByText(/\$6\.?000/)).toBeInTheDocument();

    expect(screen.getByText(/Pozo neto repartido:/i) || screen.getByText(/Pozo neto:/i)).toBeInTheDocument();
    expect(screen.getByText(/\$45\.?000/)).toBeInTheDocument();
  });

  test('R3: Leaderboard expansion includes PJ, Victorias, and chronological position trend', async () => {
    // Tournaments array returned by API is reverse-chronological (t-b, then t-a)
    mockTournaments = [
      {
        id: 't-b',
        name: 'Fecha 2',
        status: 'completed',
        buy_in_amount: 10000,
        rake_amount: 2000,
        created_at: '2026-07-02T12:00:00Z',
        championship_id: 'champ-active',
        payout_structure: [50, 30, 20]
      },
      {
        id: 't-a',
        name: 'Fecha 1',
        status: 'completed',
        buy_in_amount: 10000,
        rake_amount: 2000,
        created_at: '2026-07-01T12:00:00Z',
        championship_id: 'champ-active',
        payout_structure: [50, 30, 20]
      }
    ];

    // Let's compute standings chronologically:
    // AFTER T-a (N=3 players):
    // Player 1 (elimination_position = 1): points = (3-1+1)*10 + 50 = 80. Rank 1
    // Player 2 (elimination_position = 2): points = (3-2+1)*10 + 30 = 50. Rank 2
    // Player 3 (elimination_position = 3): points = (3-3+1)*10 + 20 = 30. Rank 3
    //
    // AFTER T-b (N=3 players):
    // Player 2 (elimination_position = 1, rebuys = 1): points in B = (3-1+1)*10 + 50 + 2 = 82. Total = 50 + 82 = 132. Rank 1 (from Rank 2). Trend: UP (▲)
    // Player 1 (elimination_position = 2): points in B = (3-2+1)*10 + 30 = 50. Total = 80 + 50 = 130. Rank 2 (from Rank 1). Trend: DOWN (▼)
    // Player 3 (elimination_position = 3): points in B = (3-3+1)*10 + 20 = 30. Total = 30 + 30 = 60. Rank 3 (from Rank 3). Trend: SAME (●)

    mockTournamentPlayers = [
      // Tournament A (completed first)
      { tournament_id: 't-a', player_id: 'p-1', guest_name: null, rebuys_count: 0, has_add_on: false, elimination_position: 1, payout_amount: 0, player: { name: 'Player 1' } },
      { tournament_id: 't-a', player_id: 'p-2', guest_name: null, rebuys_count: 0, has_add_on: false, elimination_position: 2, payout_amount: 0, player: { name: 'Player 2' } },
      { tournament_id: 't-a', player_id: 'p-3', guest_name: null, rebuys_count: 0, has_add_on: false, elimination_position: 3, payout_amount: 0, player: { name: 'Player 3' } },
      
      // Tournament B (completed second)
      { tournament_id: 't-b', player_id: 'p-2', guest_name: null, rebuys_count: 1, has_add_on: false, elimination_position: 1, payout_amount: 0, player: { name: 'Player 2' } },
      { tournament_id: 't-b', player_id: 'p-1', guest_name: null, rebuys_count: 0, has_add_on: false, elimination_position: 2, payout_amount: 0, player: { name: 'Player 1' } },
      { tournament_id: 't-b', player_id: 'p-3', guest_name: null, rebuys_count: 0, has_add_on: false, elimination_position: 3, payout_amount: 0, player: { name: 'Player 3' } }
    ];

    mockChampionships = [
      { id: 'champ-active', name: 'Liga Invierno', status: 'active', created_at: '2026-07-01T00:00:00Z' }
    ];

    render(<Dashboard onNavigate={vi.fn()} />);

    // Verify leaderboard column headers for PJ, Victorias, Tendencia
    await waitFor(() => {
      expect(screen.getByText('Player 2')).toBeInTheDocument();
    });

    expect(screen.getByText('PJ') || screen.getByText('Partidas')).toBeInTheDocument();
    expect(screen.getByText('Victorias') || screen.getByText('Wins') || screen.getByText('V')).toBeInTheDocument();
    expect(screen.getByText('Tendencia') || screen.getByText('Trend') || screen.getByText('T')).toBeInTheDocument();

    // Verify Player 2: PJ = 2, Victorias = 1, Trend = ▲
    const rowPlayer2 = screen.getByText('Player 2').closest('tr') || screen.getByText('Player 2').closest('div');
    expect(rowPlayer2).toBeInTheDocument();
    expect(rowPlayer2?.textContent).toContain('2');
    expect(rowPlayer2?.textContent).toContain('1');
    expect(rowPlayer2?.textContent).toContain('▲');

    // Verify Player 1: PJ = 2, Victorias = 1, Trend = ▼
    const rowPlayer1 = screen.getByText('Player 1').closest('tr') || screen.getByText('Player 1').closest('div');
    expect(rowPlayer1).toBeInTheDocument();
    expect(rowPlayer1?.textContent).toContain('2');
    expect(rowPlayer1?.textContent).toContain('1');
    expect(rowPlayer1?.textContent).toContain('▼');

    // Verify Player 3: PJ = 2, Victorias = 0, Trend = ●
    const rowPlayer3 = screen.getByText('Player 3').closest('tr') || screen.getByText('Player 3').closest('div');
    expect(rowPlayer3).toBeInTheDocument();
    expect(rowPlayer3?.textContent).toContain('2');
    expect(rowPlayer3?.textContent).toContain('0');
    expect(rowPlayer3?.textContent).toContain('●');
  });

  test('R4: Mobile responsiveness check for layouts', async () => {
    mockChampionships = [
      { id: 'champ-active', name: 'Liga Invierno', status: 'active', created_at: '2026-07-01T00:00:00Z' }
    ];
    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Torneos Organizados')).toBeInTheDocument();
    });

    const metricsContainer = screen.getByText('Torneos Organizados').closest('.dashboard-metrics-grid');
    expect(metricsContainer).toBeInTheDocument();
    expect(metricsContainer?.className).toContain('dashboard-metrics-grid');

    const contentContainer = screen.getByText('Historial y Torneos Activos').closest('.dashboard-content-grid');
    expect(contentContainer).toBeInTheDocument();
    expect(contentContainer?.className).toContain('dashboard-content-grid');
  });
});
