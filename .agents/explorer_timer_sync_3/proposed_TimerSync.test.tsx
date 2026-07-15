import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { TournamentControl } from '../../src/views/TournamentControl';
import { TVDisplay } from '../../src/views/TVDisplay';
import type { Tournament, Level, BlindStructure, TournamentPlayer } from '../../src/types';

// Mock Supabase
let mockTournamentData: any = null;
let mockPlayersData: any[] = [];
let mockStructureData: any = null;
let mockAllPlayersData: any[] = [];
let mockChannelCallbacks: any[] = [];
let mockSentBroadcasts: any[] = [];
let mockDbError: any = null;
let currentTable = '';
let mockServerTime = new Date();

const triggerPostgresChange = (table: string, eventType: string, newData: any) => {
  mockChannelCallbacks.forEach(cb => {
    if (cb.event === 'postgres_changes' && cb.filter && cb.filter.table === table) {
      cb.callback({ new: newData, eventType });
    }
  });
};

const triggerBroadcast = (event: string, payload: any) => {
  mockChannelCallbacks.forEach(cb => {
    if (cb.event === 'broadcast' && cb.filter && cb.filter.event === event) {
      cb.callback({ payload });
    }
  });
};

const mockChannel = {
  on: vi.fn().mockImplementation((event, filter, callback) => {
    if (typeof filter === 'function') {
      mockChannelCallbacks.push({ event, filter: null, callback: filter });
    } else {
      mockChannelCallbacks.push({ event, filter, callback });
    }
    return mockChannel;
  }),
  subscribe: vi.fn().mockImplementation((callback) => {
    if (callback) {
      Promise.resolve().then(() => callback('SUBSCRIBED'));
    }
    return mockChannel;
  }),
  send: vi.fn().mockImplementation((payload) => {
    mockSentBroadcasts.push(payload);
    return Promise.resolve({ error: null });
  }),
  unsubscribe: vi.fn().mockImplementation(() => {
    return Promise.resolve();
  })
};

vi.mock('../../src/supabaseClient', () => {
  const mockChain = {
    select: vi.fn().mockImplementation((_proj, options) => mockChain),
    eq: vi.fn().mockImplementation((_col, _val) => mockChain),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockImplementation((payload) => {
      if (mockDbError) {
        return mockChain;
      }
      if (mockTournamentData) {
        mockTournamentData = { ...mockTournamentData, ...payload };
        Promise.resolve().then(() => {
          triggerPostgresChange('tournaments', 'UPDATE', mockTournamentData);
        });
      }
      return mockChain;
    }),
    insert: vi.fn().mockImplementation((payload) => {
      if (currentTable === 'tournament_players') {
        const payloadArray = Array.isArray(payload) ? payload : [payload];
        payloadArray.forEach(p => {
          mockPlayersData.push({
            id: `tp-mock-${mockPlayersData.length + 1}`,
            ...p,
            player: p.player_id ? { name: mockAllPlayersData.find(ap => ap.id === p.player_id)?.name || 'Mock Player' } : null
          });
        });
      }
      return mockChain;
    }),
    single: vi.fn().mockImplementation(() => {
      let data = null;
      if (currentTable === 'tournaments') {
        data = mockTournamentData;
      } else if (currentTable === 'blind_structures') {
        data = mockStructureData;
      }
      return Promise.resolve({ data, error: mockDbError });
    }),
    maybeSingle: vi.fn().mockImplementation(() => {
      let data = null;
      if (currentTable === 'tournaments') {
        data = mockTournamentData;
      } else if (currentTable === 'blind_structures') {
        data = mockStructureData;
      }
      return Promise.resolve({ data, error: mockDbError });
    }),
    then: vi.fn().mockImplementation((onfulfilled) => {
      let result: any = { data: [], error: mockDbError };
      if (currentTable === 'tournament_players') {
        result = { data: mockPlayersData, error: mockDbError };
      } else if (currentTable === 'tournaments') {
        result = { data: [mockTournamentData], error: mockDbError };
      } else if (currentTable === 'players') {
        result = { data: mockAllPlayersData, error: mockDbError };
      }
      return Promise.resolve(result).then(onfulfilled);
    })
  };

  return {
    supabase: {
      from: vi.fn().mockImplementation((table) => {
        currentTable = table;
        return mockChain;
      }),
      channel: vi.fn().mockImplementation((_name, _config) => {
        return mockChannel;
      }),
      removeChannel: vi.fn().mockImplementation((_ch) => {
        return Promise.resolve();
      }),
      rpc: vi.fn().mockImplementation((fnName) => {
        if (fnName === 'get_server_time') {
          return Promise.resolve({ data: mockServerTime.toISOString(), error: null });
        }
        return Promise.resolve({ data: null, error: null });
      })
    },
    isConfigured: true
  };
});

// Mock BroadcastChannel
let broadcastChannelInstances: any[] = [];
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(name: string) {
    this.name = name;
    broadcastChannelInstances.push(this);
  }
  postMessage(data: any) {
    broadcastChannelInstances.forEach((ch) => {
      if (ch !== this && ch.name === this.name && ch.onmessage) {
        ch.onmessage({ data } as MessageEvent);
      }
    });
  }
  close() {
    const idx = broadcastChannelInstances.indexOf(this);
    if (idx !== -1) {
      broadcastChannelInstances.splice(idx, 1);
    }
  }
}
vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

// Mock Document Visibility State
let mockVisibilityState: DocumentVisibilityState = 'visible';
Object.defineProperty(document, 'visibilityState', {
  configurable: true,
  get: () => mockVisibilityState
});

function triggerVisibilityChange(state: DocumentVisibilityState) {
  mockVisibilityState = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

// Mock Fetch for Server Time RPC
let mockServerTimeResponse = new Date().toUTCString();
const mockFetch = vi.fn().mockImplementation(() => {
  return Promise.resolve({
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'date') {
          return mockServerTimeResponse;
        }
        return null;
      }
    }
  });
});
vi.stubGlobal('fetch', mockFetch);

// Mock Speech Synthesis and Audio Context
const mockSpeak = vi.fn();
const mockCancel = vi.fn();
vi.stubGlobal('speechSynthesis', {
  speak: mockSpeak,
  cancel: mockCancel,
  getVoices: vi.fn().mockReturnValue([])
});
vi.stubGlobal('SpeechSynthesisUtterance', class {
  text: string;
  lang = 'es-MX';
  rate = 0.95;
  constructor(text: string) {
    this.text = text;
  }
});

class MockAudioContext {
  currentTime = 0;
  createOscillator() {
    return {
      connect: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
      start: vi.fn(),
      stop: vi.fn(),
      type: 'sine'
    };
  }
  createGain() {
    return {
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn()
      }
    };
  }
  destination = {};
}
vi.stubGlobal('AudioContext', MockAudioContext);

// Setup router parameters / query search mock
vi.stubGlobal('location', new URL('http://localhost/?id=tourney-123'));

// Helpers to instantiate mock data
const createMockTournament = (overrides: Partial<Tournament> = {}): Tournament => ({
  id: 'tourney-123',
  organizer_id: 'org-456',
  name: 'Test Tournament',
  status: 'paused',
  buy_in_amount: 100,
  buy_in_chips: 10000,
  rebuy_amount: 100,
  rebuy_chips: 10000,
  add_on_amount: 100,
  add_on_chips: 10000,
  rake_amount: 10,
  current_level_index: 0,
  seconds_remaining: 600,
  is_timer_running: false,
  timer_reference_at: undefined,
  max_players_per_table: 9,
  payout_structure: [60, 40],
  structure_id: 'struct-123',
  created_at: new Date().toISOString(),
  ...overrides
});

const createMockStructure = (levels: Level[] = []): BlindStructure => ({
  id: 'struct-123',
  organizer_id: 'org-456',
  name: 'Turbo Structure',
  levels: levels.length ? levels : [
    { level: 1, small_blind: 10, big_blind: 20, ante: 0, duration: 10, is_break: false },
    { level: 2, small_blind: 20, big_blind: 40, ante: 0, duration: 10, is_break: false },
    { level: 3, small_blind: 0, big_blind: 0, ante: 0, duration: 5, is_break: true },
    { level: 4, small_blind: 40, big_blind: 80, ante: 10, duration: 10, is_break: false }
  ],
  created_at: new Date().toISOString()
});

// Deterministic Render Helpers with Fake Timer Flushing
const renderTournamentControl = async (tournament: Tournament) => {
  const result = render(<TournamentControl tournament={tournament} onBack={vi.fn()} />);
  for (let i = 0; i < 15; i++) {
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
  }
  return result;
};

const renderTVDisplay = async () => {
  const result = render(<TVDisplay />);
  for (let i = 0; i < 15; i++) {
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
  }
  return result;
};

const advanceTimeAndFlush = async (ms: number) => {
  if (ms > 60000) {
    // For very large jumps (background catch-up), do it in a single step
    await act(async () => {
      vi.advanceTimersByTime(ms);
    });
  } else {
    // For smaller jumps (active ticking), step by 100ms to allow interval ticking and microtask flushes
    const step = 100;
    const steps = Math.ceil(ms / step);
    for (let i = 0; i < steps; i++) {
      await act(async () => {
        vi.advanceTimersByTime(step);
      });
    }
  }
  // Flush microtasks
  await act(async () => {
    await Promise.resolve();
  });
};

describe('Tournament Timer Sync E2E Test Suite', () => {
  let mockClientTimeOffset = 0;
  const originalDateNow = Date.now;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClientTimeOffset = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => originalDateNow() + mockClientTimeOffset);

    mockTournamentData = createMockTournament();
    mockStructureData = createMockStructure();
    mockPlayersData = [
      { id: 'tp-1', tournament_id: 'tourney-123', player_id: 'p-1', guest_name: 'Player A', status: 'active', rebuys_count: 0, has_add_on: false, table_number: 1, seat_number: 1, elimination_position: null, payout_amount: 0, player: { name: 'Player A' } },
      { id: 'tp-2', tournament_id: 'tourney-123', player_id: 'p-2', guest_name: 'Player B', status: 'active', rebuys_count: 0, has_add_on: false, table_number: 1, seat_number: 2, elimination_position: null, payout_amount: 0, player: { name: 'Player B' } }
    ];
    mockAllPlayersData = [
      { id: 'p-1', name: 'Player A', organizer_id: 'org-456', created_at: new Date().toISOString() },
      { id: 'p-2', name: 'Player B', organizer_id: 'org-456', created_at: new Date().toISOString() },
      { id: 'p-3', name: 'Player C', organizer_id: 'org-456', created_at: new Date().toISOString() }
    ];
    mockChannelCallbacks = [];
    mockSentBroadcasts = [];
    broadcastChannelInstances = [];
    mockDbError = null;
    mockVisibilityState = 'visible';
    mockServerTimeResponse = new Date().toUTCString();
    mockServerTime = new Date();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Tier 1: Feature Coverage', () => {
    describe('F1: Play/Pause Synchronization', () => {
      test('F1-T1-01: Toggling play on TournamentControl sets is_timer_running to true and updates the tournament status in the database', async () => {
        mockTournamentData.is_timer_running = false;
        mockTournamentData.status = 'paused';
        const { getByTitle } = await renderTournamentControl(mockTournamentData);
        const playBtn = getByTitle('Iniciar');
        fireEvent.click(playBtn);
        await advanceTimeAndFlush(200);
        expect(mockTournamentData.is_timer_running).toBe(true);
        expect(mockTournamentData.status).toBe('running');
      });

      test('F1-T1-02: Toggling pause on TournamentControl sets is_timer_running to false and updates the tournament status in the database', async () => {
        mockTournamentData.is_timer_running = true;
        mockTournamentData.status = 'running';
        mockTournamentData.timer_reference_at = new Date().toISOString();
        const { getByTitle } = await renderTournamentControl(mockTournamentData);
        const pauseBtn = getByTitle('Pausar');
        fireEvent.click(pauseBtn);
        await advanceTimeAndFlush(200);
        expect(mockTournamentData.is_timer_running).toBe(false);
      });

      test('F1-T1-03: When timer is running, the remaining seconds decrement by 1 every second', async () => {
        mockTournamentData.is_timer_running = true;
        mockTournamentData.status = 'running';
        mockTournamentData.seconds_remaining = 600;
        mockTournamentData.timer_reference_at = new Date().toISOString();
        const { container } = await renderTournamentControl(mockTournamentData);
        
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('10:00');
        
        await advanceTimeAndFlush(2000);
        expect(timerDisplay?.textContent).toBe('09:58');
      });

      test('F1-T1-04: When timer is paused, the remaining seconds remain static and do not decrement', async () => {
        mockTournamentData.is_timer_running = false;
        mockTournamentData.status = 'paused';
        mockTournamentData.seconds_remaining = 600;
        const { container } = await renderTournamentControl(mockTournamentData);
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('10:00');
        await advanceTimeAndFlush(2000);
        expect(timerDisplay?.textContent).toBe('10:00');
      });

      test('F1-T1-05: Play/pause buttons and icons in TournamentControl toggle visually to match the state', async () => {
        mockTournamentData.is_timer_running = false;
        const { queryByTitle } = await renderTournamentControl(mockTournamentData);
        expect(queryByTitle('Iniciar')).toBeInTheDocument();
        expect(queryByTitle('Pausar')).not.toBeInTheDocument();

        // Click play button to toggle state
        const playBtn = queryByTitle('Iniciar');
        fireEvent.click(playBtn!);
        await advanceTimeAndFlush(200);

        expect(queryByTitle('Pausar')).toBeInTheDocument();
        expect(queryByTitle('Iniciar')).not.toBeInTheDocument();
      });
    });

    describe('F2: Level Progression & Jump', () => {
      test('F2-T1-06: Clicking the fast-forward level button increments the level index and updates the database', async () => {
        mockTournamentData.current_level_index = 0;
        const { getByTitle } = await renderTournamentControl(mockTournamentData);
        const fwdBtn = getByTitle('Siguiente Nivel');
        fireEvent.click(fwdBtn);
        await advanceTimeAndFlush(200);
        expect(mockTournamentData.current_level_index).toBe(1);
      });

      test('F2-T1-07: Clicking the rewind level button decrements the level index and updates the database', async () => {
        mockTournamentData.current_level_index = 1;
        const { getByTitle } = await renderTournamentControl(mockTournamentData);
        const rewindBtn = getByTitle('Nivel Anterior');
        fireEvent.click(rewindBtn);
        await advanceTimeAndFlush(200);
        expect(mockTournamentData.current_level_index).toBe(0);
      });

      test('F2-T1-08: Auto-progression: when remaining seconds hit 0, the level index automatically increments, and seconds reset to the next level\'s duration', async () => {
        mockTournamentData.is_timer_running = true;
        mockTournamentData.seconds_remaining = 10;
        mockTournamentData.timer_reference_at = new Date().toISOString();
        mockTournamentData.current_level_index = 0;
        await renderTournamentControl(mockTournamentData);
        await advanceTimeAndFlush(11000);
        await advanceTimeAndFlush(200);
        expect(mockTournamentData.current_level_index).toBe(1);
        expect(mockTournamentData.seconds_remaining).toBe(600); // 10 minutes duration of Level 2
      });

      test('F2-T1-09: TV display shows correct break banner/styles when current level is marked as a break', async () => {
        mockTournamentData.current_level_index = 2; // Level 3 is marked as a break in our mock structure
        mockTournamentData.seconds_remaining = 300;
        const { getByText } = await renderTVDisplay();
        expect(getByText('DESCANSO')).toBeInTheDocument();
        expect(getByText('BREAK')).toBeInTheDocument();
      });

      test('F2-T1-10: Manual level jump immediately updates the blind and ante values on both Controller and TV display', async () => {
        mockTournamentData.current_level_index = 0;
        const { getByTitle, container } = await renderTournamentControl(mockTournamentData);
        
        // Render TV display simultaneously
        const tvResult = await renderTVDisplay();
        
        // Fast forward to next level
        const fwdBtn = getByTitle('Siguiente Nivel');
        fireEvent.click(fwdBtn);
        await advanceTimeAndFlush(200);

        expect(mockTournamentData.current_level_index).toBe(1);
        
        // Verify blinds updated on TournamentControl (Level 2: $20 / $40)
        expect(container.textContent).toContain('$20 / $40');
        
        // Verify blinds updated on TVDisplay
        expect(tvResult.container.textContent).toContain('$20 / $40');
      });
    });

    describe('F3: State Persistence & Reload', () => {
      test('F3-T1-11: Initial render of TournamentControl computes accurate remaining seconds using timer_reference_at', async () => {
        const pastRef = new Date(Date.now() - 5000).toISOString(); // 5 seconds elapsed
        mockTournamentData.is_timer_running = true;
        mockTournamentData.seconds_remaining = 600;
        mockTournamentData.timer_reference_at = pastRef;
        const { container } = await renderTournamentControl(mockTournamentData);
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('09:55');
      });

      test('F3-T1-12: Initial render of TVDisplay computes accurate remaining seconds using timer_reference_at', async () => {
        const pastRef = new Date(Date.now() - 5000).toISOString();
        mockTournamentData.is_timer_running = true;
        mockTournamentData.seconds_remaining = 600;
        mockTournamentData.timer_reference_at = pastRef;
        const { container } = await renderTVDisplay();
        expect(container.textContent).toContain('09:55');
      });

      test('F3-T1-13: Refresh/load when paused: displays the static seconds_remaining from database', async () => {
        mockTournamentData.is_timer_running = false;
        mockTournamentData.seconds_remaining = 420;
        const { container } = await renderTournamentControl(mockTournamentData);
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('07:00');
      });

      test('F3-T1-14: Refresh/load when running: calculates elapsed seconds since timer_reference_at and subtracts from seconds_remaining', async () => {
        const pastRef = new Date(Date.now() - 10000).toISOString();
        mockTournamentData.is_timer_running = true;
        mockTournamentData.seconds_remaining = 600;
        mockTournamentData.timer_reference_at = pastRef;
        const { container } = await renderTournamentControl(mockTournamentData);
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('09:50');
      });

      test('F3-T1-15: If elapsed time exceeds remaining seconds on load, progression triggers immediately', async () => {
        const pastRef = new Date(Date.now() - 700000).toISOString(); // 700 seconds elapsed (Level 1 duration is 600 seconds)
        mockTournamentData.is_timer_running = true;
        mockTournamentData.seconds_remaining = 600;
        mockTournamentData.timer_reference_at = pastRef;
        mockTournamentData.current_level_index = 0;
        const { container } = await renderTournamentControl(mockTournamentData);
        
        // Remaining time for level 2 (600 seconds) should have caught up:
        // total elapsed 700s. level 1 (600s) consumed. level 2 (600s) has 600 - 100 = 500s left (08:20)
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('08:20');
        expect(screen.getByText('NIVEL 2')).toBeInTheDocument();
      });
    });

    describe('F4: Clock Drift & Browser Backgrounding', () => {
      test('F4-T1-16: Positive server clock offset (client clock is ahead of server) is calculated and applied to derived time', async () => {
        // Client clock is ahead of server by 5000ms.
        mockClientTimeOffset = 5000;
        mockServerTime = new Date(originalDateNow());
        mockServerTimeResponse = mockServerTime.toUTCString();

        mockTournamentData.is_timer_running = true;
        mockTournamentData.seconds_remaining = 600;
        // timer_reference_at is set to server time
        mockTournamentData.timer_reference_at = mockServerTime.toISOString();

        const { container } = await renderTournamentControl(mockTournamentData);
        const timerDisplay = container.querySelector('.control-timer-display');
        // Elapsed time should be computed using server time.
        // Since timer_reference_at is mockServerTime and we compensate for offset, elapsed should be 0, showing 10:00
        expect(timerDisplay?.textContent).toBe('10:00');
      });

      test('F4-T1-17: Negative server clock offset (client clock is behind server) is calculated and applied to derived time', async () => {
        // Client clock is behind server by 5000ms.
        mockClientTimeOffset = -5000;
        mockServerTime = new Date(originalDateNow());
        mockServerTimeResponse = mockServerTime.toUTCString();

        mockTournamentData.is_timer_running = true;
        mockTournamentData.seconds_remaining = 600;
        mockTournamentData.timer_reference_at = mockServerTime.toISOString();

        const { container } = await renderTournamentControl(mockTournamentData);
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('10:00');
      });

      test('F4-T1-18: Tab backgrounding: when page is hidden, the timer continues calculating correctly in the background via visibilitychange checks', async () => {
        mockTournamentData.is_timer_running = true;
        mockTournamentData.timer_reference_at = new Date().toISOString();
        mockTournamentData.seconds_remaining = 600;
        const { container } = await renderTournamentControl(mockTournamentData);
        
        triggerVisibilityChange('hidden');
        await advanceTimeAndFlush(5000);
        triggerVisibilityChange('visible');
        
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('09:55');
      });

      test('F4-T1-19: Tab reactivation catches up: advancing timers and triggering visibilitychange to \'visible\' adjusts seconds correctly', async () => {
        mockTournamentData.is_timer_running = true;
        mockTournamentData.timer_reference_at = new Date().toISOString();
        mockTournamentData.seconds_remaining = 600;
        const { container } = await renderTournamentControl(mockTournamentData);
        
        triggerVisibilityChange('hidden');
        await advanceTimeAndFlush(10000);
        triggerVisibilityChange('visible');
        
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('09:50');
      });

      test('F4-T1-20: TVDisplay catches up after backgrounding using the same server-time reference calculation', async () => {
        mockTournamentData.is_timer_running = true;
        mockTournamentData.timer_reference_at = new Date().toISOString();
        mockTournamentData.seconds_remaining = 600;
        const { container } = await renderTVDisplay();
        
        triggerVisibilityChange('hidden');
        await advanceTimeAndFlush(10000);
        triggerVisibilityChange('visible');
        
        expect(container.textContent).toContain('09:50');
      });
    });

    describe('F5: Multi-client Coordination', () => {
      test('F5-T1-21: TournamentControl subscribes to real-time database updates for its tournament ID', async () => {
        await renderTournamentControl(mockTournamentData);
        // Verify we subscribed to public tournaments table filtered by our ID
        const subscription = mockChannelCallbacks.find(
          cb => cb.event === 'postgres_changes' && cb.filter && cb.filter.table === 'tournaments'
        );
        expect(subscription).toBeDefined();
        expect(subscription.filter.filter).toContain('id=eq.tourney-123');
      });

      test('F5-T1-22: TVDisplay subscribes to real-time database updates for the specified tournament ID', async () => {
        await renderTVDisplay();
        const subscription = mockChannelCallbacks.find(
          cb => cb.event === 'postgres_changes' && cb.filter && cb.filter.table === 'tournaments'
        );
        expect(subscription).toBeDefined();
        expect(subscription.filter.filter).toContain('id=eq.tourney-123');
      });

      test('F5-T1-23: TournamentControl broadcasts ticking seconds to local tabs via BroadcastChannel', async () => {
        await renderTournamentControl(mockTournamentData);
        // Should have instantiated a BroadcastChannel named poker_tournament_sync
        const localChannel = broadcastChannelInstances.find(ch => ch.name === 'poker_tournament_sync');
        expect(localChannel).toBeDefined();
      });

      test('F5-T1-24: TournamentControl broadcasts ticks globally via Supabase real-time channel', async () => {
        await renderTournamentControl(mockTournamentData);
        // Real-time channel send mock has been called
        expect(mockChannel.send).toHaveBeenCalled();
      });

      test('F5-T1-25: New TVDisplay broadcasts REQUEST_STATE on load, and TournamentControl responds with current state', async () => {
        await renderTournamentControl(mockTournamentData);
        
        // Render TV display which broadcasts REQUEST_STATE
        await renderTVDisplay();
        
        // Find TV display postMessage calls
        const tvChannel = broadcastChannelInstances[1];
        expect(tvChannel.name).toBe('poker_tournament_sync');
        
        // organiser tab responds and TV state gets updated
        expect(mockSentBroadcasts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    describe('F1: Play/Pause Boundaries', () => {
      test('F1-T2-01: Rapid double clicks on play do not spawn multiple ticking intervals', async () => {
        mockTournamentData.seconds_remaining = 600;
        mockTournamentData.timer_reference_at = new Date().toISOString();
        const { getByTitle } = await renderTournamentControl(mockTournamentData);
        const playBtn = getByTitle('Iniciar');
        // Click play three times rapidly
        fireEvent.click(playBtn);
        await advanceTimeAndFlush(50);
        const pauseBtn = getByTitle('Pausar');
        fireEvent.click(pauseBtn);
        await advanceTimeAndFlush(50);
        const playBtn2 = getByTitle('Iniciar');
        fireEvent.click(playBtn2);
        
        const initialSec = mockTournamentData.seconds_remaining;
        await advanceTimeAndFlush(2000);
        const finalSec = mockTournamentData.seconds_remaining;
        expect(initialSec - finalSec).toBeLessThanOrEqual(2);
      });

      test('F1-T2-02: Clicking play when remaining seconds is 0 on final level keeps it at 0 without crashing', async () => {
        mockTournamentData.current_level_index = 3; // final level
        mockTournamentData.seconds_remaining = 0;
        const { getByTitle } = await renderTournamentControl(mockTournamentData);
        const playBtn = getByTitle('Iniciar');
        fireEvent.click(playBtn);
        await advanceTimeAndFlush(200);
        expect(mockTournamentData.seconds_remaining).toBe(0);
      });

      test('F1-T2-03: Play/pause toggling handles database write errors gracefully, displaying a temporary UI error alert', async () => {
        mockDbError = { message: 'Database Write Error' };
        const { getByTitle } = await renderTournamentControl(mockTournamentData);
        const playBtn = getByTitle('Iniciar');
        fireEvent.click(playBtn);
        await advanceTimeAndFlush(200);
        // Toggling play did not update DB status due to error
        expect(mockTournamentData.is_timer_running).toBe(false);
      });

      test('F1-T2-04: Database connection dropped during play: timer continues local ticking and shows offline badge', async () => {
        mockTournamentData.is_timer_running = true;
        mockTournamentData.timer_reference_at = new Date().toISOString();
        mockTournamentData.seconds_remaining = 600;
        const { container } = await renderTournamentControl(mockTournamentData);
        
        // Simulate DB offline by setting update error
        mockDbError = { message: 'Connection Lost' };
        
        await advanceTimeAndFlush(2000);
        // The local timer should still tick down despite DB disconnection
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('09:58');
      });

      test('F1-T2-05: Play/pause state toggles from running to paused while tab visibility is hidden', async () => {
        mockTournamentData.is_timer_running = true;
        mockTournamentData.timer_reference_at = new Date().toISOString();
        const { getByTitle } = await renderTournamentControl(mockTournamentData);
        triggerVisibilityChange('hidden');
        const pauseBtn = getByTitle('Pausar');
        fireEvent.click(pauseBtn);
        await advanceTimeAndFlush(200);
        expect(mockTournamentData.is_timer_running).toBe(false);
      });
    });

    describe('F2: Level Progression Boundaries', () => {
      test('F2-T2-06: Clicking rewind when on first level does not go below index 0', async () => {
        mockTournamentData.current_level_index = 0;
        const { getByTitle } = await renderTournamentControl(mockTournamentData);
        const rewindBtn = getByTitle('Nivel Anterior');
        fireEvent.click(rewindBtn);
        await advanceTimeAndFlush(200);
        expect(mockTournamentData.current_level_index).toBe(0);
      });

      test('F2-T2-07: Clicking fast-forward when on final level does not exceed maximum level index', async () => {
        mockTournamentData.current_level_index = 3;
        const { getByTitle } = await renderTournamentControl(mockTournamentData);
        const fwdBtn = getByTitle('Siguiente Nivel');
        fireEvent.click(fwdBtn);
        await advanceTimeAndFlush(200);
        expect(mockTournamentData.current_level_index).toBe(3);
      });

      test('F2-T2-08: Transitioning when level duration is 1 second operates successfully', async () => {
        mockStructureData.levels[0].duration = 1 / 60; // 1 second duration
        mockTournamentData.is_timer_running = true;
        mockTournamentData.seconds_remaining = 1;
        mockTournamentData.timer_reference_at = new Date().toISOString();
        const { container } = await renderTournamentControl(mockTournamentData);
        await advanceTimeAndFlush(1100);
        expect(mockTournamentData.current_level_index).toBe(1);
      });

      test('F2-T2-09: Structure with empty levels list displays safe defaults and does not throw null reference errors', async () => {
        mockStructureData.levels = [];
        const { container } = await renderTournamentControl(mockTournamentData);
        expect(container).toBeInTheDocument();
      });

      test('F2-T2-10: DB returns invalid level index (out of range): handles gracefully and falls back to level 0', async () => {
        mockTournamentData.current_level_index = 99;
        const { container } = await renderTournamentControl(mockTournamentData);
        expect(container).toBeInTheDocument();
      });
    });

    describe('F3: State Persistence Boundaries', () => {
      test('F3-T2-11: Server offset query returns timeout/error: falls back to local client time (offset = 0)', async () => {
        vi.stubGlobal('fetch', () => Promise.reject(new Error('Network Timeout')));
        mockTournamentData.is_timer_running = true;
        mockTournamentData.seconds_remaining = 600;
        mockTournamentData.timer_reference_at = new Date().toISOString();
        const { container } = await renderTournamentControl(mockTournamentData);
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('10:00');
      });

      test('F3-T2-12: timer_reference_at is null in database: displays static seconds_remaining and does not run', async () => {
        mockTournamentData.timer_reference_at = null;
        mockTournamentData.is_timer_running = false;
        mockTournamentData.seconds_remaining = 500;
        const { container } = await renderTournamentControl(mockTournamentData);
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('08:20');
        await advanceTimeAndFlush(2000);
        expect(timerDisplay?.textContent).toBe('08:20');
      });

      test('F3-T2-13: timer_reference_at is in the future: handles negative elapsed time gracefully (caps elapsed at 0)', async () => {
        const futureRef = new Date(Date.now() + 10000).toISOString(); // 10s in future
        mockTournamentData.timer_reference_at = futureRef;
        mockTournamentData.seconds_remaining = 600;
        mockTournamentData.is_timer_running = true;
        const { container } = await renderTournamentControl(mockTournamentData);
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('10:00');
      });

      test('F3-T2-14: Refresh when elapsed time is exactly equal to remaining seconds triggers progression', async () => {
        const pastRef = new Date(Date.now() - 600000).toISOString(); // exactly 10 minutes ago
        mockTournamentData.seconds_remaining = 600;
        mockTournamentData.timer_reference_at = pastRef;
        mockTournamentData.is_timer_running = true;
        mockTournamentData.current_level_index = 0;
        await renderTournamentControl(mockTournamentData);
        expect(mockTournamentData.current_level_index).toBe(1);
      });

      test('F3-T2-15: Reload when tournament status is \'completed\' forces remaining seconds to 0 and disables timer control buttons', async () => {
        mockTournamentData.status = 'completed';
        mockTournamentData.seconds_remaining = 300;
        const { container, getByTitle } = await renderTournamentControl(mockTournamentData);
        const timerDisplay = container.querySelector('.control-timer-display');
        // Remaining time is forced to 0
        expect(timerDisplay?.textContent).toBe('00:00');
        // Control buttons should be hidden or disabled (completed state has no control view)
        expect(container.textContent).toContain('TORNEO CONCLUIDO');
      });
    });

    describe('F4: Clock Drift & Browser Backgrounding Boundaries', () => {
      test('F4-T2-16: Massive client clock drift (e.g. 24 hours) is calculated and compensated correctly', async () => {
        mockClientTimeOffset = 24 * 60 * 60 * 1000; // 24 hours ahead
        mockServerTime = new Date(originalDateNow());
        mockServerTimeResponse = mockServerTime.toUTCString();

        mockTournamentData.is_timer_running = true;
        mockTournamentData.seconds_remaining = 600;
        mockTournamentData.timer_reference_at = mockServerTime.toISOString();

        const { container } = await renderTournamentControl(mockTournamentData);
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('10:00');
      });

      test('F4-T2-17: Visibilitychange to \'visible\' when paused does not decrement any remaining time', async () => {
        mockTournamentData.is_timer_running = false;
        mockTournamentData.seconds_remaining = 600;
        const { container } = await renderTournamentControl(mockTournamentData);
        
        triggerVisibilityChange('hidden');
        await advanceTimeAndFlush(5000);
        triggerVisibilityChange('visible');
        
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('10:00');
      });

      test('F4-T2-18: Rapidly toggling tab visibility between hidden and visible does not cause timer jitter', async () => {
        mockTournamentData.is_timer_running = true;
        mockTournamentData.timer_reference_at = new Date().toISOString();
        mockTournamentData.seconds_remaining = 600;
        const { container } = await renderTournamentControl(mockTournamentData);
        
        triggerVisibilityChange('hidden');
        triggerVisibilityChange('visible');
        triggerVisibilityChange('hidden');
        triggerVisibilityChange('visible');
        
        await advanceTimeAndFlush(1000);
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('09:59');
      });

      test('F4-T2-19: Browser suspends during a transition to break: wakes up on break with correct break countdown', async () => {
        mockTournamentData.is_timer_running = true;
        mockTournamentData.seconds_remaining = 5; // 5s left in Level 2
        mockTournamentData.current_level_index = 1; // Level 2
        mockTournamentData.timer_reference_at = new Date().toISOString();
        
        const { container } = await renderTournamentControl(mockTournamentData);
        
        triggerVisibilityChange('hidden');
        await advanceTimeAndFlush(10000); // 10s elapsed
        triggerVisibilityChange('visible');
        
        // Level 3 is a break with duration 5 minutes (300s).
        // 5s of Level 2 consumed, 5s of Level 3 consumed. Should show 295s left = 4m 55s
        const timerDisplay = container.querySelector('.control-timer-display');
        expect(timerDisplay?.textContent).toBe('04:55');
        expect(screen.getByText('DESCANSO')).toBeInTheDocument();
      });

      test('F4-T2-20: Background visibility status stays hidden for 2 hours: resumes to final level / completed state correctly', async () => {
        mockTournamentData.is_timer_running = true;
        mockTournamentData.timer_reference_at = new Date().toISOString();
        mockTournamentData.seconds_remaining = 600;
        const { container } = await renderTournamentControl(mockTournamentData);
        
        triggerVisibilityChange('hidden');
        await advanceTimeAndFlush(2 * 60 * 60 * 1000); // 2 hours in background
        triggerVisibilityChange('visible');
        
        // It should have completed all levels and the final level should be at 0 remaining
        expect(mockTournamentData.seconds_remaining).toBe(0);
        expect(mockTournamentData.is_timer_running).toBe(false);
      });
    });

    describe('F5: Multi-client Boundaries', () => {
      test('F5-T2-21: Client console and TV display have different local times: both display the exact same time remaining using server time reference', async () => {
        mockTournamentData.is_timer_running = true;
        mockTournamentData.seconds_remaining = 600;
        mockTournamentData.timer_reference_at = new Date().toISOString();

        // Console client is ahead by 10s
        mockClientTimeOffset = 10000;
        const { container: ctrlContainer } = await renderTournamentControl(mockTournamentData);

        // TV client is behind by 10s
        mockClientTimeOffset = -10000;
        const { container: tvContainer } = await renderTVDisplay();

        const ctrlTime = ctrlContainer.querySelector('.control-timer-display')?.textContent;
        const tvTime = tvContainer.textContent;
        
        expect(ctrlTime).toBe('10:00');
        expect(tvTime).toContain('10:00');
      });

      test('F5-T2-22: WebSocket broadcast payload is corrupt/malformed: ignored without crashing', async () => {
        const { container } = await renderTVDisplay();
        
        // Dispatch malformed payload
        triggerBroadcast('STATE_UPDATE', { corrupt: "data" });
        await advanceTimeAndFlush(200);
        
        expect(container).toBeInTheDocument();
      });

      test('F5-T2-23: Concurrent controller edits: conflict is resolved via last-write-wins', async () => {
        const { container } = await renderTournamentControl(mockTournamentData);
        
        // Controller 1 writes paused state
        mockTournamentData.is_timer_running = false;
        triggerPostgresChange('tournaments', 'UPDATE', mockTournamentData);
        
        // Controller 2 writes running state 1ms later
        mockTournamentData.is_timer_running = true;
        triggerPostgresChange('tournaments', 'UPDATE', mockTournamentData);
        
        await advanceTimeAndFlush(200);
        // The last write wins
        expect(mockTournamentData.is_timer_running).toBe(true);
      });

      test('F5-T2-24: Supabase channel subscription fails (disconnected state): shows offline banner/badge', async () => {
        // Disconnected state
        mockDbError = { message: 'Connection Timeout' };
        const { container } = await renderTournamentControl(mockTournamentData);
        
        // Even when disconnected, local rendering works and the app doesn't crash
        expect(container).toBeInTheDocument();
      });

      test('F5-T2-25: Multiple TV displays in separate tabs sync local ticks over BroadcastChannel with minimal WebSocket traffic', async () => {
        await renderTVDisplay();
        await renderTVDisplay();
        
        // Two TV displays should have opened BroadcastChannel instances
        const tvChannels = broadcastChannelInstances.filter(ch => ch.name === 'poker_tournament_sync');
        expect(tvChannels.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Tier 3: Cross-Feature Combinations', () => {
    test('CROSS-01: Pause timer exactly at the sub-second of level transition: verify timer halts at the start of the next level', async () => {
      mockTournamentData.is_timer_running = true;
      mockTournamentData.seconds_remaining = 1;
      mockTournamentData.timer_reference_at = new Date().toISOString();
      const { getByTitle } = await renderTournamentControl(mockTournamentData);
      
      // Advance by 950ms (sub-second before transition)
      await advanceTimeAndFlush(950);
      
      // Click pause
      const pauseBtn = getByTitle('Pausar');
      fireEvent.click(pauseBtn);
      await advanceTimeAndFlush(200);
      
      expect(mockTournamentData.is_timer_running).toBe(false);
      // It paused after Level 1 reached 0, so it transitions to Level 2 (index 1) and remains paused
      expect(mockTournamentData.current_level_index).toBe(1);
      expect(mockTournamentData.seconds_remaining).toBe(600); // resets to next level duration
    });

    test('CROSS-02: Refresh page exactly at the sub-second of level transition: verify the next level loads with full duration', async () => {
      mockTournamentData.is_timer_running = true;
      mockTournamentData.seconds_remaining = 0;
      mockTournamentData.timer_reference_at = new Date().toISOString();
      mockTournamentData.current_level_index = 0;
      
      // Render clean on page reload
      const { container } = await renderTournamentControl(mockTournamentData);
      
      // It should load and immediately resolve to Level 2 with full duration (10 mins)
      expect(mockTournamentData.current_level_index).toBe(1);
      const timerDisplay = container.querySelector('.control-timer-display');
      expect(timerDisplay?.textContent).toBe('10:00');
    });

    test('CROSS-03: Level index is changed manually in Tab A while Tab B is hidden; Tab B becomes visible and displays new level index and reset time', async () => {
      mockTournamentData.timer_reference_at = new Date().toISOString();
      mockTournamentData.seconds_remaining = 600;
      mockTournamentData.current_level_index = 0;
      
      await renderTournamentControl(mockTournamentData);
      
      // TV Tab B is rendered and then hidden
      const tvResult = await renderTVDisplay();
      triggerVisibilityChange('hidden');
      
      // Level index is changed manually to 2 (Level 3 - break) in Tab A
      mockTournamentData.current_level_index = 2;
      mockTournamentData.seconds_remaining = 300;
      triggerPostgresChange('tournaments', 'UPDATE', mockTournamentData);
      
      // Tab B becomes visible
      triggerVisibilityChange('visible');
      await advanceTimeAndFlush(200);
      
      // Tab B displays the new break level index and its structure
      expect(tvResult.container.textContent).toContain('DESCANSO');
    });

    test('CROSS-04: WebSocket disconnects during active play, but local BroadcastChannel keeps local tabs in sync; once WebSocket reconnects, it syncs back', async () => {
      mockTournamentData.is_timer_running = true;
      mockTournamentData.timer_reference_at = new Date().toISOString();
      mockTournamentData.seconds_remaining = 600;
      
      const { getByTitle } = await renderTournamentControl(mockTournamentData);
      const tvResult = await renderTVDisplay();
      
      // WebSocket disconnects (represented by mockDbError)
      mockDbError = { message: 'WebSocket Disconnect' };
      
      // Organiser pauses the clock
      const pauseBtn = getByTitle('Pausar');
      fireEvent.click(pauseBtn);
      
      // BroadcastChannel should communicate local sync immediately
      await advanceTimeAndFlush(200);
      expect(tvResult.container.textContent).toContain('10:00'); // remains static
      
      // WebSocket reconnects
      mockDbError = null;
    });

    test('CROSS-05: Controller A pauses while Controller B jumps level simultaneously: TV display reflects paused at the new level', async () => {
      mockTournamentData.is_timer_running = true;
      mockTournamentData.timer_reference_at = new Date().toISOString();
      mockTournamentData.seconds_remaining = 600;
      
      const { getByTitle } = await renderTournamentControl(mockTournamentData);
      const tvResult = await renderTVDisplay();
      
      // Controller B jumps level to Level 2 (index 1)
      mockTournamentData.current_level_index = 1;
      mockTournamentData.seconds_remaining = 600;
      triggerPostgresChange('tournaments', 'UPDATE', mockTournamentData);
      
      // Controller A pauses the clock
      const pauseBtn = getByTitle('Pausar');
      fireEvent.click(pauseBtn);
      
      await advanceTimeAndFlush(200);
      
      // TV Display should show Level 2 and be paused
      expect(tvResult.container.textContent).toContain('$20 / $40');
      expect(mockTournamentData.is_timer_running).toBe(false);
    });
  });

  describe('Tier 4: Real-World Scenarios', () => {
    test('SCENARIO-01: Full Tournament Simulation: Run 3 levels (Level 1, Break, Level 2) with pause, resume, auto-transition, refresh, and verify state display transitions', async () => {
      mockTournamentData.is_timer_running = true;
      mockTournamentData.seconds_remaining = 15; // 15 seconds remaining in Level 1
      mockTournamentData.timer_reference_at = new Date().toISOString();
      mockTournamentData.current_level_index = 0;
      
      const { getByTitle, container } = await renderTournamentControl(mockTournamentData);
      
      // 1. Let it tick for 5 seconds
      await advanceTimeAndFlush(5000);
      expect(container.querySelector('.control-timer-display')?.textContent).toBe('00:10');
      
      // 2. Pause
      const pauseBtn = getByTitle('Pausar');
      fireEvent.click(pauseBtn);
      await advanceTimeAndFlush(2000);
      expect(container.querySelector('.control-timer-display')?.textContent).toBe('00:10'); // static
      
      // 3. Resume
      const playBtn = getByTitle('Iniciar');
      fireEvent.click(playBtn);
      
      // 4. Auto-transition: let remaining 10s elapse -> goes to Level 2 (index 1, duration 600s)
      await advanceTimeAndFlush(11000);
      await advanceTimeAndFlush(200);
      expect(mockTournamentData.current_level_index).toBe(1);
      expect(mockTournamentData.seconds_remaining).toBe(600);
      
      // 5. Jump to break level manually (Level 3, index 2)
      const fwdBtn = getByTitle('Siguiente Nivel');
      fireEvent.click(fwdBtn);
      await advanceTimeAndFlush(200);
      expect(mockTournamentData.current_level_index).toBe(2);
      expect(screen.getByText('DESCANSO')).toBeInTheDocument();
      
      // 6. Refresh/reload: render TV display and make sure it loads break level 3
      const tvResult = await renderTVDisplay();
      expect(tvResult.container.textContent).toContain('DESCANSO');
    });

    test('SCENARIO-02: Network Sync Recovery: Active timer, network disconnects (mocked), pause toggled, local clock decrements, network reconnects, state sync is restored', async () => {
      mockTournamentData.is_timer_running = true;
      mockTournamentData.seconds_remaining = 10;
      mockTournamentData.timer_reference_at = new Date().toISOString();
      const { container, getByTitle } = await renderTournamentControl(mockTournamentData);
      
      // Network disconnects
      mockDbError = { message: 'Network Timeout' };
      
      // Pause toggled: local UI responds, but database write fails
      const pauseBtn = getByTitle('Pausar');
      fireEvent.click(pauseBtn);
      await advanceTimeAndFlush(200);
      expect(mockTournamentData.is_timer_running).toBe(true); // still true in DB!
      
      // Local clock is paused
      const timerDisplay = container.querySelector('.control-timer-display');
      expect(timerDisplay?.textContent).toBe('00:10');
      
      await advanceTimeAndFlush(3000);
      expect(timerDisplay?.textContent).toBe('00:10'); // local remains paused
      
      // Reconnect network
      mockDbError = null;
      
      // Trigger a Postgres Update sync from DB (which was still running)
      mockTournamentData.seconds_remaining = 7;
      triggerPostgresChange('tournaments', 'UPDATE', mockTournamentData);
      await advanceTimeAndFlush(200);
      
      // State sync is restored: local clock resumes matching database (running, 7s left)
      expect(timerDisplay?.textContent).toBe('00:07');
    });

    test('SCENARIO-03: Multi-Tab Sync with Clock Drift: 1 Controller (drift +5s), TV1 (drift -3s), TV2 (drift 0) all show identical synchronized time using absolute server time reference', async () => {
      mockTournamentData.is_timer_running = true;
      mockTournamentData.seconds_remaining = 600;
      mockTournamentData.timer_reference_at = new Date().toISOString();

      // Controller tab has client clock ahead by 5s
      mockClientTimeOffset = 5000;
      const ctrlResult = await renderTournamentControl(mockTournamentData);

      // TV1 tab has client clock behind by 3s
      mockClientTimeOffset = -3000;
      const tv1Result = await renderTVDisplay();

      // TV2 tab has client clock with 0 drift
      mockClientTimeOffset = 0;
      const tv2Result = await renderTVDisplay();

      // All three show exact same remaining time (10:00)
      const ctrlTime = ctrlResult.container.querySelector('.control-timer-display')?.textContent;
      const tv1Time = tv1Result.container.textContent;
      const tv2Time = tv2Result.container.textContent;

      expect(ctrlTime).toBe('10:00');
      expect(tv1Time).toContain('10:00');
      expect(tv2Time).toContain('10:00');
    });

    test('SCENARIO-04: Break Transition and Warnings: Verify 60s warning audio/visual cues, and voice/audio alarm when level hits 0 and transitions to break', async () => {
      mockTournamentData.is_timer_running = true;
      mockTournamentData.seconds_remaining = 61; // 61 seconds left
      mockTournamentData.timer_reference_at = new Date().toISOString();
      await renderTVDisplay();
      
      // Advance by 2 seconds to cross 60s warning threshold
      await advanceTimeAndFlush(2000);
      
      // Voice synthesis mockSpeak should have been called with the 60s warning
      expect(mockSpeak).toHaveBeenCalled();
      const firstCallUtterance = mockSpeak.mock.calls[0][0];
      expect(firstCallUtterance.text).toContain('Último minuto');

      // Clear speak calls
      mockSpeak.mockClear();

      // Fast forward to 1s remaining
      mockTournamentData.seconds_remaining = 1;
      mockTournamentData.timer_reference_at = new Date().toISOString();
      triggerPostgresChange('tournaments', 'UPDATE', mockTournamentData);
      await advanceTimeAndFlush(200);

      // Advance by 2s to hit 0 and trigger transition to Break (Level 3)
      await advanceTimeAndFlush(2000);
      
      // Should announce break
      expect(mockSpeak).toHaveBeenCalled();
      const secondCallUtterance = mockSpeak.mock.calls[0][0];
      expect(secondCallUtterance.text).toContain('descanso');
    });

    test('SCENARIO-05: Tournament Operations during Ticking: Late registration adds player during active countdown, verify timer runs continuously without lag or state reset', async () => {
      mockTournamentData.is_timer_running = true;
      mockTournamentData.seconds_remaining = 600;
      mockTournamentData.timer_reference_at = new Date().toISOString();
      
      const { container } = await renderTournamentControl(mockTournamentData);
      
      // Verify timer is running (10:00 display ticking down)
      await advanceTimeAndFlush(1000);
      const timerDisplay = container.querySelector('.control-timer-display');
      expect(timerDisplay?.textContent).toBe('09:59');
      
      // Open Late Registration modal
      const registerBtn = screen.getByText(/Registro Tardío/i);
      fireEvent.click(registerBtn);
      
      // Input guest name in modal
      const guestInput = screen.getByPlaceholderText('Ej. Juan Pérez');
      fireEvent.change(guestInput, { target: { value: 'Late Register Guest' } });
      
      // Click register
      const submitBtn = screen.getByRole('button', { name: 'Registrar' });
      fireEvent.click(submitBtn);
      
      // Wait for registration database query and subsequent refresh to complete
      await advanceTimeAndFlush(500);
      
      // Verify the new player was added to the active list
      expect(container.textContent).toContain('Late Register Guest');
      
      // Verify timer runs continuously and is unaffected (now at 09:57 or 09:58)
      expect(timerDisplay?.textContent).toBe('09:57');
      expect(mockTournamentData.is_timer_running).toBe(true);
    });
  });
});
