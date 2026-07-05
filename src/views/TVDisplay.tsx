import React, { useEffect, useState, useRef } from 'react';
import { Trophy, Users, Landmark, Clock, Volume2, VolumeX } from 'lucide-react';

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
}

export const TVDisplay: React.FC = () => {
  const [state, setState] = useState<TVState | null>(null);
  const [localSeconds, setLocalSeconds] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastAnnouncedLevelRef = useRef<number>(-1);

  const stateRef = useRef<TVState | null>(null);
  const voiceEnabledRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

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

  useEffect(() => {
    // Connect to BroadcastChannel
    const channel = new BroadcastChannel('poker_tournament_sync');
    broadcastChannelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'STATE_UPDATE') {
        setState(payload);
        setLocalSeconds(payload.seconds_remaining);
        
        // Voice announcement if level changed
        if (payload.current_level_index !== lastAnnouncedLevelRef.current) {
          if (lastAnnouncedLevelRef.current !== -1) {
            if (voiceEnabledRef.current) {
              speakAnnounce(`¡Atención! Ciegas suben. Nivel nuevo. Ciegas: ${payload.small_blind} y ${payload.big_blind}. Ante de ${payload.ante || 0}`);
            } else {
              playAlarmSound();
            }
          }
          lastAnnouncedLevelRef.current = payload.current_level_index;
        }
      } else if (type === 'TICK') {
        setLocalSeconds(payload.seconds_remaining);
      }
    };

    // Request state from organizer window upon opening
    channel.postMessage({ type: 'REQUEST_STATE' });

    // Local tick interpolation for smooth clock transitions
    const interval = setInterval(() => {
      const currentState = stateRef.current;
      if (currentState && currentState.is_timer_running) {
        setLocalSeconds(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      channel.close();
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
          <div style={styles.levelHeading}>NIVEL {state.current_level_index + 1}</div>
          
          {/* Big Timer */}
          <div style={styles.timerDisplay}>
            {formatTime(localSeconds)}
          </div>

          {/* Huge Blinds display */}
          <div style={styles.blindsBox}>
            <div style={styles.blindsLabel}>CIEGAS</div>
            <div style={styles.blindsVal}>
              ${state.small_blind.toLocaleString()} / ${state.big_blind.toLocaleString()}
            </div>
            {state.ante > 0 && (
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
