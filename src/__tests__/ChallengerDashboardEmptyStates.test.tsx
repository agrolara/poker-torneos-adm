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

describe('Dashboard Empty States and Division-by-Zero Boundary Tests', () => {
  beforeEach(() => {
    mockTournaments = [];
    mockPlayersCount = 0;
    mockTournamentPlayers = [];
    mockChampionships = [];
    currentTable = '';
    isCountQuery = false;
    vi.clearAllMocks();
  });

  test('Case 1: No active championship, no tournaments, no players', async () => {
    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Torneos Organizados')).toBeInTheDocument();
    });

    // Stats checks
    expect(screen.getByText('0')).toBeInTheDocument(); // totalTourneys
    expect(screen.getByText('$0')).toBeInTheDocument(); // totalPrizePool (or $0.00)
    expect(screen.getByText('0.0 recompras')).toBeInTheDocument(); // avgRebuys displays 0.0 without division by zero crash

    // Leaderboard state
    expect(screen.getByText('No tienes campeonatos activos para calcular rankings.')).toBeInTheDocument();
  });

  test('Case 2: Active championship with 0 tournaments', async () => {
    mockChampionships = [
      { id: 'champ-1', name: 'Liga Vacio', status: 'active', created_at: '2026-07-15T00:00:00Z' }
    ];

    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Liga Vacio')).toBeInTheDocument();
    });

    // Leaderboard shows empty state message
    expect(screen.getByText('Aún no hay fechas completadas en este campeonato.')).toBeInTheDocument();
    expect(screen.getByText('0.0 recompras')).toBeInTheDocument();
  });

  test('Case 3: Active championship with completed tournaments but 0 players', async () => {
    mockChampionships = [
      { id: 'champ-1', name: 'Liga Con Torneo Vacio', status: 'active', created_at: '2026-07-15T00:00:00Z' }
    ];
    mockTournaments = [
      {
        id: 't-vacio',
        name: 'Fecha 1 Vacía',
        status: 'completed',
        buy_in_amount: 10000,
        rake_amount: 2000,
        created_at: '2026-07-15T12:00:00Z',
        championship_id: 'champ-1'
      }
    ];
    mockTournamentPlayers = []; // 0 players

    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Liga Con Torneo Vacio')).toBeInTheDocument();
    });

    // Rake and financial metrics
    // Total Rake = 0 players * 2000 = 0
    // Total Prize pool = 0
    // Rebuys = 0.0
    expect(screen.getByText('0.0 recompras')).toBeInTheDocument();
    expect(screen.getByText('Aún no hay fechas completadas en este campeonato.')).toBeInTheDocument();
  });
});
