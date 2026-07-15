import React, { useEffect, useState, useRef } from 'react';
import { Trophy, Users, Landmark, Clock, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface TVState {
  tournament_name: string;
  status: string;
  seconds_remaining: number;
  is_timer_running: boolean;
  current_level_index: number;
  small_blind: number;
  big_blind: number;
  ante: number;
  next_small_blind: number;
  next_big_blind: number;
  next_ante: number;
  active_players: number;
  total_players: number;
  average_stack: number;
  prize_pool: number;
  payouts: number[];
  is_break?: boolean;
  duration_minutes?: number;
  level_label?: string;
  timer_reference_at?: string | null;
}

export const TVDisplay: React.FC = () => {
  const [state, setState] = useState<TVState | null>(null);
  const [localSeconds, setLocalSeconds] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastAnnouncedLevelRef = useRef<number>(-1);
  const lastWarnedMinuteLevelRef = useRef<number>(-1);

  const stateRef = useRef<TVState | null>(null);
  const voiceEnabledRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  // Monitor when localSeconds hits 60 to play warning in TVDisplay
  useEffect(() => {
    if (state && state.is_timer_running && localSeconds === 60) {
      if (lastWarnedMinuteLevelRef.current !== state.current_level_index) {
        if (voiceEnabled) {
          speakAnnounce("¡Último minuto de nivel!");
        } else {
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
          } catch (e) {}
        }
        lastWarnedMinuteLevelRef.current = state.current_level_index;
      }
    }
  }, [localSeconds, state, voiceEnabled]);

  const playAlarmSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (startTime: number, frequency: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(frequency, startTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = audioCtx.currentTime;
      playBeep(now, 587.33, 0.4); // D5
      playBeep(now + 0.5, 587.33, 0.4);
      playBeep(now + 1.0, 880.00, 0.8); // A5
    } catch (e) {
      console.error('Failed to play audio:', e);
    }
  };

  const speakAnnounce = (txt: string) => {
    playAlarmSound();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(txt);
      utterance.lang = 'es-MX';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  const clockOffsetRef = useRef<number>(0);
  const dbSecondsRemainingRef = useRef<number>(0);
  const dbIsTimerRunningRef = useRef<boolean>(false);
  const dbTimerReferenceAtRef = useRef<string | null>(null);
  const dbCurrentLevelIndexRef = useRef<number>(0);

  const deriveSeconds = () => {
    const seconds_remaining = dbSecondsRemainingRef.current;
    const is_timer_running = dbIsTimerRunningRef.current;
    const timer_reference_at = dbTimerReferenceAtRef.current;
    const Offset = clockOffsetRef.current;

    if (!is_timer_running) {
      return seconds_remaining;
    }

    const resolvedRef = timer_reference_at || new Date(Date.now() + Offset).toISOString();
    const RemainingMs = (seconds_remaining * 1000) - (Date.now() + Offset - new Date(resolvedRef).getTime());
    const RemainingSeconds = Math.max(0, Math.ceil(RemainingMs / 1000));
    return RemainingSeconds;
  };

  // Helper: derive accurate seconds from a DB snapshot with timer_reference_at and client offset
  const deriveSecondsFromSnapshot = (dbSeconds: number, referenceAt: string | null | undefined, isRunning: boolean): number => {
    if (!isRunning) return dbSeconds;
    const resolvedRefAt = referenceAt || new Date(Date.now() + clockOffsetRef.current).toISOString();
    const refTime = new Date(resolvedRefAt).getTime();
    const nowServer = Date.now() + clockOffsetRef.current;
    const elapsed = Math.floor((nowServer - refTime) / 1000);
    return Math.max(0, dbSeconds - elapsed);
  };

  const updateTVStateAndAnnounce = (newState: TVState) => {
    const resolvedRef = newState.is_timer_running && !newState.timer_reference_at
      ? new Date(Date.now() + clockOffsetRef.current).toISOString()
      : (newState.timer_reference_at || null);

    setState({ ...newState, timer_reference_at: resolvedRef });
    
    dbSecondsRemainingRef.current = newState.seconds_remaining;
    dbIsTimerRunningRef.current = newState.is_timer_running;
    dbTimerReferenceAtRef.current = resolvedRef;
    dbCurrentLevelIndexRef.current = newState.current_level_index;
    
    setLocalSeconds(deriveSeconds());
    
    // Voice announcement if level changed
    if (newState.current_level_index !== lastAnnouncedLevelRef.current) {
      if (lastAnnouncedLevelRef.current !== -1) {
        if (voiceEnabledRef.current) {
          if (newState.is_break) {
            speakAnnounce(`¡Tiempo de descanso! Iniciamos un descanso de ${newState.duration_minutes || 15} minutos.`);
          } else {
            speakAnnounce(`¡Atención! Ciegas suben. Nivel nuevo. Ciegas: ${newState.small_blind} y ${newState.big_blind}. Ante de ${newState.ante || 0}`);
          }
        } else {
          playAlarmSound();
        }
      }
      lastAnnouncedLevelRef.current = newState.current_level_index;
    }
  };

  const fetchStateFromDb = async (tournamentId: string) => {
    try {
      // 1. Fetch tournament
      const { data: tData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();
      if (!tData) return;

      // 2. Fetch players
      const { data: pData } = await supabase
        .from('tournament_players')
        .select('*, player:players(name)')
        .eq('tournament_id', tournamentId);
      const players = pData || [];

      // 3. Fetch structure
      let structure = null;
      if (tData.structure_id) {
        const { data: sData } = await supabase
          .from('blind_structures')
          .select('*')
          .eq('id', tData.structure_id)
          .single();
        structure = sData;
      }

      // Helper to get levels
      const getLevelsArray = (structure: any) => {
        if (!structure) return [];
        if (Array.isArray(structure.levels)) return structure.levels;
        return structure.levels.levels || [];
      };

      const levels = getLevelsArray(structure);
      const activeIdx = tData.current_level_index;
      const activeLevel = levels[activeIdx] || null;
      const nextLevel = levels[activeIdx + 1] || null;

      const activeCount = players.filter((p: any) => p.status === 'active').length;
      
      // Calculate financials
      const totalBuyIns = players.length * (tData.buy_in_amount || 0);
      const totalRebuys = players.reduce((sum: number, tp: any) => sum + (tp.rebuys_count || 0) * (tData.rebuy_amount || 0), 0);
      const totalAddOns = players.reduce((sum: number, tp: any) => sum + (tp.has_add_on ? (tData.add_on_amount || 0) : 0), 0);
      const totalPrizePool = totalBuyIns + totalRebuys + totalAddOns;
      const totalRake = players.length * (tData.rake_amount || 0);
      const prizePool = Math.max(0, totalPrizePool - totalRake);

      // Payouts calculation
      const payoutPct = tData.payout_structure || [50, 30, 20];
      const payouts = payoutPct.map((pct: number) => Math.round((prizePool * pct) / 100));

      // Average stack calculation
      const chipsBuyIn = tData.buy_in_chips || 0;
      const chipsRebuy = tData.rebuy_chips || 0;
      const chipsAddOn = tData.add_on_chips || 0;
      const totalChips = players.length * chipsBuyIn +
        players.reduce((sum: number, tp: any) => sum + (tp.rebuys_count || 0) * chipsRebuy, 0) +
        players.reduce((sum: number, tp: any) => sum + (tp.has_add_on ? chipsAddOn : 0), 0);
      const averageStack = activeCount > 0 ? Math.round(totalChips / activeCount) : 0;

      // Compensate timer using the helper (deriveSecondsFromSnapshot)
      const resolvedRef = tData.is_timer_running && !tData.timer_reference_at
        ? new Date(Date.now() + clockOffsetRef.current).toISOString()
        : (tData.timer_reference_at || null);

      const derivedSec = deriveSecondsFromSnapshot(
        tData.seconds_remaining,
        resolvedRef,
        tData.is_timer_running
      );

      // Populate transition refs with latest DB data
      dbSecondsRemainingRef.current = tData.seconds_remaining;
      dbIsTimerRunningRef.current = tData.is_timer_running;
      dbTimerReferenceAtRef.current = resolvedRef;
      dbCurrentLevelIndexRef.current = tData.current_level_index;

      const tvState: TVState = {
        tournament_name: tData.name,
        status: tData.status,
        seconds_remaining: derivedSec,
        is_timer_running: tData.is_timer_running,
        current_level_index: activeIdx,
        small_blind: activeLevel?.small_blind || 0,
        big_blind: activeLevel?.big_blind || 0,
        ante: activeLevel?.ante || 0,
        next_small_blind: nextLevel?.small_blind || 0,
        next_big_blind: nextLevel?.big_blind || 0,
        next_ante: nextLevel?.ante || 0,
        active_players: activeCount,
        total_players: players.length,
        average_stack: averageStack,
        prize_pool: prizePool,
        payouts: payouts,
        is_break: activeLevel?.is_break || false,
        duration_minutes: activeLevel?.duration || 0,
        level_label: activeLevel?.is_break ? 'DESCANSO' : `NIVEL ${activeLevel?.level || 1}`,
        timer_reference_at: resolvedRef
      };

      updateTVStateAndAnnounce(tvState);
    } catch (err) {
      console.error('Error fetching TV state from Supabase:', err);
    }
  };

  useEffect(() => {
    // Get tournament ID from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get('id');

    // Fetch server clock offset to compensate for client system clock drift
    const fetchOffset = async () => {
      try {
        if (!supabase) return;
        const start = Date.now();
        const { data, error } = await supabase.rpc('get_server_time');
        const end = Date.now();
        if (error) throw error;
        if (data) {
          const serverTime = new Date(data).getTime();
          const rtt = end - start;
          clockOffsetRef.current = serverTime + (rtt / 2) - end;
        }
      } catch (e) {
        console.error('Failed to calculate server clock offset via RPC:', e);
      }
    };

    fetchOffset().then(() => {
      if (tournamentId) {
        fetchStateFromDb(tournamentId);
      }
    });

    // Connect to BroadcastChannel (local tabs sync)
    const channel = new BroadcastChannel('poker_tournament_sync');
    broadcastChannelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'STATE_UPDATE') {
        const resolvedRef = payload.is_timer_running && !payload.timer_reference_at
          ? new Date(Date.now() + clockOffsetRef.current).toISOString()
          : (payload.timer_reference_at || null);
        dbSecondsRemainingRef.current = payload.seconds_remaining;
        dbIsTimerRunningRef.current = payload.is_timer_running;
        dbTimerReferenceAtRef.current = resolvedRef;
        dbCurrentLevelIndexRef.current = payload.current_level_index;
        updateTVStateAndAnnounce({ ...payload, timer_reference_at: resolvedRef });
      }
    };

    // Request state from local organizer window upon opening
    channel.postMessage({ type: 'REQUEST_STATE' });

    let realtimeChannel: any = null;

    if (tournamentId) {
      // Subscribe to realtime updates and broadcast channel
      realtimeChannel = supabase
        .channel('timer_sync', {
          config: {
            broadcast: { self: false }
          }
        })
        .on('broadcast', { event: 'STATE_CHANGE' }, (payload: any) => {
          const data = payload.payload;
          if (data && data.tournament_id === tournamentId) {
            const resolvedRef = data.is_timer_running && !data.timer_reference_at
              ? new Date(Date.now() + clockOffsetRef.current).toISOString()
              : (data.timer_reference_at || null);
            dbSecondsRemainingRef.current = data.seconds_remaining;
            dbIsTimerRunningRef.current = data.is_timer_running;
            dbTimerReferenceAtRef.current = resolvedRef;
            dbCurrentLevelIndexRef.current = data.current_level_index;
            setLocalSeconds(deriveSeconds());
          }
        })
        .on('broadcast', { event: 'STATE_UPDATE' }, (payload: any) => {
          const data = payload.payload;
          if (data && data.tournament_id === tournamentId) {
            const resolvedRef = data.is_timer_running && !data.timer_reference_at
              ? new Date(Date.now() + clockOffsetRef.current).toISOString()
              : (data.timer_reference_at || null);
            dbSecondsRemainingRef.current = data.seconds_remaining;
            dbIsTimerRunningRef.current = data.is_timer_running;
            dbTimerReferenceAtRef.current = resolvedRef;
            dbCurrentLevelIndexRef.current = data.current_level_index;
            updateTVStateAndAnnounce({ ...data, timer_reference_at: resolvedRef });
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tournaments',
            filter: `id=eq.${tournamentId}`
          },
          (payload: any) => {
            const newData = payload.new;
            if (newData) {
              const resolvedRef = newData.is_timer_running && !newData.timer_reference_at
                ? new Date(Date.now() + clockOffsetRef.current).toISOString()
                : (newData.timer_reference_at || null);
              dbSecondsRemainingRef.current = newData.seconds_remaining;
              dbIsTimerRunningRef.current = newData.is_timer_running;
              dbTimerReferenceAtRef.current = resolvedRef;
              dbCurrentLevelIndexRef.current = newData.current_level_index;
            }
            fetchStateFromDb(tournamentId);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tournament_players',
            filter: `tournament_id=eq.${tournamentId}`
          },
          () => {
            fetchStateFromDb(tournamentId);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Request state globally via broadcast
            realtimeChannel.send({
              type: 'broadcast',
              event: 'REQUEST_STATE',
              payload: {}
            });
          }
        });
    }

    // Local tick interpolation for smooth clock transitions
    const interval = setInterval(() => {
      setLocalSeconds(deriveSeconds());
    }, 100);

    return () => {
      clearInterval(interval);
      channel.close();
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  if (!state) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: '20px' }}>Esperando señal de sincronización del organizador...</p>
        <p style={styles.loadingHelp}>Asegúrate de tener abierta la consola de control del torneo en otra pestaña.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Voice and full screen helper */}
      <div style={styles.overlayHeader}>
        <span style={styles.tournamentTitle}>{state.tournament_name}</span>
        <button 
          style={{ 
            ...styles.voiceBtn, 
            borderColor: voiceEnabled ? 'var(--color-primary)' : 'var(--border-color)',
            backgroundColor: voiceEnabled ? 'var(--color-primary-glow)' : 'transparent',
            color: voiceEnabled ? 'var(--color-primary)' : 'var(--color-text-secondary)'
          }}
          onClick={() => setVoiceEnabled(!voiceEnabled)}
        >
          {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          {voiceEnabled ? 'Voz Activada' : 'Voz Silenciada'}
        </button>
      </div>

      <div style={styles.grid}>
        {/* Left column: Blinds and Clock */}
        <div style={styles.leftColumn}>
          {/* Active Level */}
          <div style={styles.levelHeading}>
            {state.is_break ? 'DESCANSO' : (state.level_label || `NIVEL ${state.current_level_index + 1}`)}
          </div>
          
          {/* Big Timer */}
          <div style={styles.timerDisplay}>
            {formatTime(localSeconds)}
          </div>

          {/* Huge Blinds display */}
          <div style={styles.blindsBox}>
            <div style={styles.blindsLabel}>{state.is_break ? 'ESTADO' : 'CIEGAS'}</div>
            <div style={{
              ...styles.blindsVal,
              color: state.is_break ? '#10b981' : '#ffffff',
              fontSize: state.is_break ? '4.2rem' : '5rem'
            }}>
              {state.is_break ? 'BREAK' : `$${state.small_blind.toLocaleString()} / $${state.big_blind.toLocaleString()}`}
            </div>
            {!state.is_break && state.ante > 0 && (
              <div style={styles.anteVal}>ANTE: ${state.ante.toLocaleString()}</div>
            )}
          </div>

          {/* Next Level preview bar */}
          {state.next_small_blind > 0 && (
            <div style={styles.nextLevelBox}>
              <div style={styles.nextLabel}>PRÓXIMO NIVEL</div>
              <div style={styles.nextVal}>
                ${state.next_small_blind.toLocaleString()} / ${state.next_big_blind.toLocaleString()}
                {state.next_ante > 0 ? ` (Ante: $${state.next_ante.toLocaleString()})` : ''}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Stats & Payouts */}
        <div style={styles.rightColumn}>
          {/* Quick Metrics */}
          <div className="glass-panel" style={styles.statsCard}>
            <div style={styles.statItem}>
              <Users size={32} color="var(--color-accent)" />
              <div>
                <div style={styles.statLabel}>Jugadores Restantes</div>
                <div style={styles.statValue}>
                  {state.active_players} <span style={styles.statSubVal}>/ {state.total_players}</span>
                </div>
              </div>
            </div>

            <div style={styles.statDivider}></div>

            <div style={styles.statItem}>
              <Clock size={32} color="var(--color-primary)" />
              <div>
                <div style={styles.statLabel}>Pila Promedio</div>
                <div style={styles.statValue}>${state.average_stack.toLocaleString()}</div>
              </div>
            </div>

            <div style={styles.statDivider}></div>

            <div style={styles.statItem}>
              <Landmark size={32} color="var(--color-secondary)" />
              <div>
                <div style={styles.statLabel}>Pozo de Premios</div>
                <div style={{ ...styles.statValue, color: 'var(--color-secondary)' }}>
                  ${state.prize_pool.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Payout Distribution Table */}
          <div className="glass-panel" style={styles.payoutCard}>
            <h3 style={styles.payoutTitle}><Trophy size={20} color="var(--color-secondary)" /> PREMIOS Y PAGOS</h3>
            <div style={styles.payoutsList}>
              {state.payouts.map((amount, idx) => (
                <div key={idx} style={styles.payoutRow}>
                  <span style={styles.payoutRank}>{idx + 1}° Puesto</span>
                  <span style={styles.payoutLine}></span>
                  <span style={styles.payoutVal}>${amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#030712',
    color: 'var(--color-text-secondary)',
    fontFamily: 'Outfit, sans-serif',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: 'var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingHelp: {
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
    marginTop: '8px',
  },
  container: {
    minHeight: '100vh',
    backgroundColor: '#03050a',
    color: '#ffffff',
    fontFamily: 'Outfit, sans-serif',
    padding: '30px 4%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  overlayHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '16px',
    marginBottom: '20px',
  },
  tournamentTitle: {
    fontSize: '1.5rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    background: 'linear-gradient(135deg, #f8fafc 40%, var(--color-text-muted) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  voiceBtn: {
    padding: '8px 16px',
    border: '1px solid',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.85rem',
    fontWeight: 650,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '50px',
    flexGrow: 1,
    alignItems: 'center',
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  levelHeading: {
    fontSize: '1.6rem',
    fontWeight: 800,
    letterSpacing: '0.2em',
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
  },
  timerDisplay: {
    fontSize: '11rem',
    fontWeight: 800,
    fontFamily: 'monospace',
    lineHeight: 1,
    margin: '10px 0',
    letterSpacing: '-0.04em',
    textShadow: '0 0 40px rgba(255, 255, 255, 0.05)',
  },
  blindsBox: {
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-xl)',
    padding: '30px 50px',
    width: '100%',
    maxWidth: '560px',
    boxShadow: '0 15px 50px rgba(0, 0, 0, 0.5)',
    marginBottom: '24px',
  },
  blindsLabel: {
    fontSize: '0.9rem',
    fontWeight: 800,
    letterSpacing: '0.15em',
    color: 'var(--color-text-secondary)',
    marginBottom: '8px',
  },
  blindsVal: {
    fontSize: '3.6rem',
    fontWeight: 800,
    color: 'var(--color-primary)',
    lineHeight: 1.1,
    textShadow: '0 0 20px rgba(16, 185, 129, 0.25)',
  },
  anteVal: {
    fontSize: '1.8rem',
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    marginTop: '10px',
    letterSpacing: '0.05em',
  },
  nextLevelBox: {
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '20px',
    width: '100%',
    maxWidth: '500px',
  },
  nextLabel: {
    fontSize: '0.8rem',
    fontWeight: 800,
    letterSpacing: '0.1em',
    color: 'var(--color-text-muted)',
    marginBottom: '6px',
  },
  nextVal: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--color-text-secondary)',
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
  },
  statsCard: {
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  statLabel: {
    fontSize: '0.85rem',
    fontWeight: 750,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 800,
    marginTop: '4px',
  },
  statSubVal: {
    fontSize: '1.2rem',
    color: 'var(--color-text-muted)',
    fontWeight: 500,
  },
  statDivider: {
    height: '1px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  payoutCard: {
    padding: '40px',
  },
  payoutTitle: {
    fontSize: '1.1rem',
    fontWeight: 800,
    letterSpacing: '0.1em',
    marginBottom: '24px',
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  payoutsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  payoutRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '1.15rem',
  },
  payoutRank: {
    color: 'var(--color-text-secondary)',
    fontWeight: 650,
  },
  payoutLine: {
    flexGrow: 1,
    borderBottom: '1px dashed rgba(255, 255, 255, 0.1)',
    margin: '0 16px',
  },
  payoutVal: {
    fontWeight: 800,
    color: 'var(--color-secondary)',
    fontSize: '1.3rem',
  },
};
