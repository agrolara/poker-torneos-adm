import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { Tournament, TournamentPlayer, Level, BlindStructure, TournamentLog } from '../types';
import { Play, Pause, FastForward, Rewind, Users, Award, ShieldAlert, Tv, ArrowLeft, RefreshCw } from 'lucide-react';

interface TournamentControlProps {
  tournament: Tournament;
  onBack: () => void;
}

export const TournamentControl: React.FC<TournamentControlProps> = ({ tournament: initialTournament, onBack }) => {
  const [tournament, setTournament] = useState<Tournament>(initialTournament);
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [structure, setStructure] = useState<BlindStructure | null>(null);
  const [logs, setLogs] = useState<TournamentLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Timer state (local replica for speed)
  const [secondsRemaining, setSecondsRemaining] = useState(initialTournament.seconds_remaining);
  const [isRunning, setIsRunning] = useState(initialTournament.is_timer_running);
  const [currentLevelIdx, setCurrentLevelIdx] = useState(initialTournament.current_level_index);
  
  // Seating balancing recommendation
  const [balancingAlert, setBalancingAlert] = useState<string | null>(null);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastWarnedMinuteLevelRef = useRef<number>(-1);
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    // Initialize Sync channel
    broadcastChannelRef.current = new BroadcastChannel('poker_tournament_sync');
    
    fetchTournamentData();

    // Listen for requests from newly opened TV screens
    broadcastChannelRef.current.onmessage = (event) => {
      if (event.data && event.data.type === 'REQUEST_STATE') {
        broadcastState();
      }
    };

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (broadcastChannelRef.current) broadcastChannelRef.current.close();
    };
  }, []);

  // Sync Timer with local state changes
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            return 0;
          }
          const nextSec = prev - 1;
          // Send simple tick sync
          broadcastChannelRef.current?.postMessage({
            type: 'TICK',
            payload: { seconds_remaining: nextSec }
          });
          return nextSec;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Monitor when secondsRemaining hits 0 or 60 to trigger level up or warning
  useEffect(() => {
    if (isRunning) {
      if (secondsRemaining === 0) {
        handleLevelUp();
      } else if (secondsRemaining === 60 && lastWarnedMinuteLevelRef.current !== currentLevelIdx) {
        speakAnnounce("¡Último minuto de nivel!");
        lastWarnedMinuteLevelRef.current = currentLevelIdx;
      }
    }
  }, [secondsRemaining, isRunning, currentLevelIdx]);

  // Periodic database save (every 10 seconds)
  useEffect(() => {
    let saveInterval: any;
    if (isRunning) {
      saveInterval = setInterval(() => {
        saveTimerStateToDb();
      }, 10000);
    }
    return () => {
      if (saveInterval) clearInterval(saveInterval);
    };
  }, [isRunning, secondsRemaining, currentLevelIdx]);

  const fetchTournamentData = async () => {
    try {
      setLoading(true);
      // Fetch fresh tournament data
      const { data: tData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', initialTournament.id)
        .single();
      
      if (tData) {
        setTournament(tData);
        if (isFirstLoadRef.current) {
          setSecondsRemaining(tData.seconds_remaining);
          setIsRunning(tData.is_timer_running);
          setCurrentLevelIdx(tData.current_level_index);
          isFirstLoadRef.current = false;
        }
      }

      // Fetch participants
      const { data: pData } = await supabase
        .from('tournament_players')
        .select('*, player:players(name)')
        .eq('tournament_id', initialTournament.id);
      
      setPlayers(pData || []);

      // Fetch the specific blind structure of the tournament
      if (tData && tData.structure_id) {
        const { data: sData } = await supabase
          .from('blind_structures')
          .select('*')
          .eq('id', tData.structure_id)
          .single();
        if (sData) {
          setStructure(sData);
        }
      } else {
        // Fallback to the first available structure if not set
        const { data: structures } = await supabase
          .from('blind_structures')
          .select('*')
          .limit(1);
        if (structures && structures.length > 0) {
          setStructure(structures[0]);
        }
      }

      // Fetch logs
      const { data: logsData } = await supabase
        .from('tournament_logs')
        .select('*')
        .eq('tournament_id', initialTournament.id)
        .order('created_at', { ascending: false });
      
      setLogs(logsData || []);
      
      checkTableBalance(pData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      // Initial broadcast
      setTimeout(() => broadcastState(), 500);
    }
  };



  const broadcastState = () => {
    if (!broadcastChannelRef.current) return;
    
    const activeLevel = getCurrentLevel();
    const nextLevel = getNextLevel();
    const activeCount = players.filter(p => p.status === 'active').length;

    const { prizePool, payouts } = calculateFinancials();

    broadcastChannelRef.current.postMessage({
      type: 'STATE_UPDATE',
      payload: {
        tournament_name: tournament.name,
        status: tournament.status,
        seconds_remaining: secondsRemaining,
        is_timer_running: isRunning,
        current_level_index: currentLevelIdx,
        small_blind: activeLevel?.small_blind || 0,
        big_blind: activeLevel?.big_blind || 0,
        ante: activeLevel?.ante || 0,
        next_small_blind: nextLevel?.small_blind || 0,
        next_big_blind: nextLevel?.big_blind || 0,
        next_ante: nextLevel?.ante || 0,
        active_players: activeCount,
        total_players: players.length,
        average_stack: calculateAverageStack(activeCount),
        prize_pool: prizePool,
        payouts: payouts,
      }
    });
  };

  // Sync Broadcast state whenever relevant values change
  useEffect(() => {
    if (!loading) {
      broadcastState();
    }
  }, [secondsRemaining, isRunning, currentLevelIdx, players, tournament]);

  const saveTimerStateToDb = async (overrides: Partial<Tournament> = {}) => {
    try {
      await supabase
        .from('tournaments')
        .update({
          seconds_remaining: secondsRemaining,
          is_timer_running: isRunning,
          current_level_index: currentLevelIdx,
          ...overrides
        })
        .eq('id', tournament.id);
    } catch (e) {
      console.error('Error saving timer state:', e);
    }
  };

  const handlePlayPause = () => {
    const nextRunning = !isRunning;
    setIsRunning(nextRunning);
    saveTimerStateToDb({ is_timer_running: nextRunning });
    
    // Log action
    addLog('timer_action', { message: nextRunning ? 'Reloj reanudado' : 'Reloj pausado' });
  };

  const handleLevelUp = () => {
    if (!structure) return;
    const nextIdx = currentLevelIdx + 1;
    if (nextIdx < structure.levels.length) {
      const nextLevel = structure.levels[nextIdx];
      setCurrentLevelIdx(nextIdx);
      setSecondsRemaining(nextLevel.duration * 60);
      
      // Voice synthesis announcement
      speakAnnounce(`¡Ciegas arriba! Nivel ${nextLevel.level}. Ciegas: ${nextLevel.small_blind} y ${nextLevel.big_blind}. Ante de ${nextLevel.ante}`);
      
      addLog('level_change', { level: nextLevel.level, small_blind: nextLevel.small_blind, big_blind: nextLevel.big_blind });
      saveTimerStateToDb({
        current_level_index: nextIdx,
        seconds_remaining: nextLevel.duration * 60
      });
    } else {
      setIsRunning(false);
      saveTimerStateToDb({ is_timer_running: false });
      alert('¡Has completado todos los niveles de ciegas!');
    }
  };

  const handleLevelDown = () => {
    if (!structure || currentLevelIdx === 0) return;
    const prevIdx = currentLevelIdx - 1;
    const prevLevel = structure.levels[prevIdx];
    setCurrentLevelIdx(prevIdx);
    setSecondsRemaining(prevLevel.duration * 60);
    
    addLog('level_change', { level: prevLevel.level, small_blind: prevLevel.small_blind, big_blind: prevLevel.big_blind, direction: 'back' });
    saveTimerStateToDb({
      current_level_index: prevIdx,
      seconds_remaining: prevLevel.duration * 60
    });
  };

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

  const handleAddPlayerAction = async (player: TournamentPlayer, type: 'rebuy' | 'addon' | 'eliminate') => {
    try {
      if (type === 'rebuy') {
        const newCount = player.rebuys_count + 1;
        const { error } = await supabase
          .from('tournament_players')
          .update({ rebuys_count: newCount })
          .eq('id', player.id);
        
        if (error) throw error;
        addLog('rebuy', { player_name: getPlayerName(player), count: newCount });
      } else if (type === 'addon') {
        const { error } = await supabase
          .from('tournament_players')
          .update({ has_add_on: true })
          .eq('id', player.id);
        
        if (error) throw error;
        addLog('addon', { player_name: getPlayerName(player) });
      } else if (type === 'eliminate') {
        const activeCount = players.filter(p => p.status === 'active').length;
        const { error } = await supabase
          .from('tournament_players')
          .update({ 
            status: 'eliminated',
            elimination_position: activeCount // 10th place, 9th place, etc.
          })
          .eq('id', player.id);
        
        if (error) throw error;
        
        // Voice alert on elimination
        speakAnnounce(`${getPlayerName(player)} ha sido eliminado en la posición ${activeCount}`);
        
        addLog('elimination', { player_name: getPlayerName(player), position: activeCount });

        // If only 1 player remains, mark tournament as completed!
        if (activeCount === 2) {
          handleCompleteTournament(player.id); // The other active player is the winner!
        }
      }
      
      // Reload players and logs
      fetchTournamentData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCompleteTournament = async (lastEliminatedId: string) => {
    // Find the winner (the last active player who wasn't eliminated)
    const activeList = players.filter(p => p.status === 'active' && p.id !== lastEliminatedId);
    const winner = activeList[0];
    
    try {
      setIsRunning(false);
      
      // Update winner profile row
      if (winner) {
        const { payouts } = calculateFinancials();
        const winAmount = payouts[0] || 0;
        
        await supabase
          .from('tournament_players')
          .update({ 
            elimination_position: 1,
            payout_amount: winAmount
          })
          .eq('id', winner.id);

        speakAnnounce(`¡Felicidades a ${getPlayerName(winner)} por ganar el torneo!`);
        addLog('timer_action', { message: `Torneo completado. Ganador: ${getPlayerName(winner)}` });
      }

      await supabase
        .from('tournaments')
        .update({ 
          status: 'completed',
          is_timer_running: false 
        })
        .eq('id', tournament.id);

      fetchTournamentData();
    } catch (e) {
      console.error(e);
    }
  };

  const addLog = async (type: string, payload: any) => {
    try {
      const { data, error } = await supabase
        .from('tournament_logs')
        .insert({
          tournament_id: tournament.id,
          event_type: type,
          payload: payload
        })
        .select()
        .single();
      
      if (!error && data) {
        setLogs(prev => [data, ...prev]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkTableBalance = (playersList: TournamentPlayer[]) => {
    const active = playersList.filter(p => p.status === 'active');
    if (active.length <= 1) {
      setBalancingAlert(null);
      return;
    }

    // Group active players by table
    const tableCounts: Record<number, number> = {};
    active.forEach(p => {
      if (p.table_number) {
        tableCounts[p.table_number] = (tableCounts[p.table_number] || 0) + 1;
      }
    });

    const tables = Object.keys(tableCounts).map(Number);
    if (tables.length <= 1) {
      setBalancingAlert(null);
      return;
    }

    // Find min and max
    let minTable = tables[0];
    let maxTable = tables[0];
    
    tables.forEach(t => {
      if (tableCounts[t] < tableCounts[minTable]) minTable = t;
      if (tableCounts[t] > tableCounts[maxTable]) maxTable = t;
    });

    const diff = tableCounts[maxTable] - tableCounts[minTable];

    // Check if tables should collapse
    const totalActive = active.length;
    const maxCapacity = tournament.max_players_per_table;
    const currentTableCount = tables.length;
    const neededTables = Math.ceil(totalActive / maxCapacity);

    if (neededTables < currentTableCount) {
      // Find the smallest table to break
      let smallestTable = tables[0];
      tables.forEach(t => {
        if (tableCounts[t] < tableCounts[smallestTable]) smallestTable = t;
      });
      setBalancingAlert(`⚠️ Romper Mesa ${smallestTable}: Mover todos los jugadores a asientos libres.`);
    } else if (diff >= 2) {
      setBalancingAlert(`⚠️ Desbalance: Mover un jugador de Mesa ${maxTable} (${tableCounts[maxTable]} jug.) a Mesa ${minTable} (${tableCounts[minTable]} jug.).`);
    } else {
      setBalancingAlert(null);
    }
  };

  const handleOpenTV = () => {
    window.open(`?tv=true`, '_blank', 'width=1000,height=700,menubar=no,toolbar=no,location=no');
  };

  // Helper selectors
  const getCurrentLevel = (): Level | null => {
    if (!structure) return null;
    return structure.levels[currentLevelIdx] || null;
  };

  const getNextLevel = (): Level | null => {
    if (!structure) return null;
    return structure.levels[currentLevelIdx + 1] || null;
  };

  const getPlayerName = (p: TournamentPlayer) => {
    return p.guest_name || p.player?.name || 'Jugador Invitado';
  };

  const calculateFinancials = () => {
    const buyInsCount = players.length;
    const rebuysCount = players.reduce((acc, p) => acc + p.rebuys_count, 0);
    const addOnsCount = players.filter(p => p.has_add_on).length;

    const prizePool = 
      (buyInsCount * tournament.buy_in_amount) +
      (rebuysCount * tournament.rebuy_amount) +
      (addOnsCount * tournament.add_on_amount);

    const payouts = tournament.payout_structure.map(pct => Math.round((prizePool * pct) / 100));

    return { prizePool, payouts, buyInsCount, rebuysCount, addOnsCount };
  };

  const calculateAverageStack = (activeCount: number) => {
    if (activeCount === 0) return 0;
    const buyInsCount = players.length;
    const rebuysCount = players.reduce((acc, p) => acc + p.rebuys_count, 0);
    const addOnsCount = players.filter(p => p.has_add_on).length;

    const totalChips = 
      (buyInsCount * tournament.buy_in_chips) +
      (rebuysCount * tournament.rebuy_chips) +
      (addOnsCount * tournament.add_on_chips);

    return Math.round(totalChips / activeCount);
  };

  const handleManualCompleteTournament = async () => {
    if (!window.confirm('¿Estás seguro de que deseas finalizar este torneo manualmente?')) return;
    try {
      setIsRunning(false);
      await supabase
        .from('tournaments')
        .update({ 
          status: 'completed', 
          is_timer_running: false 
        })
        .eq('id', tournament.id);
      
      addLog('timer_action', { message: 'Torneo finalizado manualmente por el organizador.' });
      onBack();
    } catch (err) {
      console.error('Error completing tournament:', err);
    }
  };

  const handleDeleteTournament = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este torneo por completo? Esta acción no se puede deshacer.')) return;
    try {
      setIsRunning(false);
      await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournament.id);
      
      onBack();
    } catch (err) {
      console.error('Error deleting tournament:', err);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const activeLevel = getCurrentLevel();
  const nextLevel = getNextLevel();
  const activePlayers = players.filter(p => p.status === 'active');
  const { prizePool, payouts } = calculateFinancials();

  if (loading && !structure) {
    return <div style={styles.loadingContainer}>Cargando centro de control del torneo...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Top Header */}
      <div style={styles.header}>
        <button className="btn btn-outline" style={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <h2 style={styles.title}>{tournament.name}</h2>
        <button className="btn btn-accent" onClick={handleOpenTV}>
          Proyectar Pantalla TV <Tv size={16} />
        </button>
      </div>

      {/* Balancing Recommendation Alert */}
      {balancingAlert && (
        <div style={styles.balancingAlertCard}>
          <ShieldAlert size={20} color="var(--color-secondary)" />
          <span style={styles.balancingText}>{balancingAlert}</span>
          <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '0.75rem', marginLeft: 'auto' }} onClick={fetchTournamentData}>
            Recalcular <RefreshCw size={12} />
          </button>
        </div>
      )}

      {/* Main Grid: Control clock on Left, Players grid on Right */}
      <div style={styles.controlGrid}>
        {/* Left Side: Clock Card and Stats */}
        <div style={styles.leftColumn}>
          {/* Clock Display Card */}
          <div className="glass-panel" style={{ ...styles.clockCard, borderColor: isRunning ? 'var(--color-primary)' : 'var(--border-color)' }}>
            <div style={styles.levelHeader}>NIVEL {activeLevel?.level || 1}</div>
            
            <div style={styles.timerDisplay}>
              {formatTime(secondsRemaining)}
            </div>

            <div style={styles.blindsDisplay}>
              ${activeLevel?.small_blind || 0} / ${activeLevel?.big_blind || 0}
              {activeLevel?.ante ? <span style={styles.anteLabel}> (Ante: ${activeLevel.ante})</span> : ''}
            </div>

            {/* Timer Controllers */}
            <div style={styles.clockControllers}>
              <button style={styles.controllerBtn} onClick={handleLevelDown} title="Nivel Anterior">
                <Rewind size={20} />
              </button>
              
              <button 
                style={{ 
                  ...styles.playBtn, 
                  backgroundColor: isRunning ? 'var(--color-danger)' : 'var(--color-primary)',
                  boxShadow: isRunning ? '0 0 15px rgba(239, 68, 68, 0.4)' : '0 0 15px rgba(16, 185, 129, 0.4)'
                }} 
                onClick={handlePlayPause}
                title={isRunning ? 'Pausar' : 'Iniciar'}
              >
                {isRunning ? <Pause size={24} color="#ffffff" /> : <Play size={24} color="#030712" />}
              </button>

              <button style={styles.controllerBtn} onClick={handleLevelUp} title="Siguiente Nivel">
                <FastForward size={20} />
              </button>
            </div>

            {/* Next Level Info */}
            {nextLevel && (
              <div style={styles.nextLevelInfo}>
                Siguiente Nivel: <span>${nextLevel.small_blind}/${nextLevel.big_blind}</span> (Ante: ${nextLevel.ante})
              </div>
            )}
          </div>

          {/* Stats Summary Card */}
          <div className="glass-panel" style={styles.statsCard}>
            <div style={styles.statRow}>
              <span>Jugadores Activos:</span>
              <span style={styles.statVal}>{activePlayers.length} / {players.length}</span>
            </div>
            <div style={styles.statRow}>
              <span>Pila Promedio:</span>
              <span style={styles.statVal}>${calculateAverageStack(activePlayers.length).toLocaleString()}</span>
            </div>
            <div style={styles.statRow}>
              <span>Pozo de Premios:</span>
              <span style={{ ...styles.statVal, color: 'var(--color-secondary)' }}>${prizePool.toLocaleString()}</span>
            </div>
            
            <div style={styles.payoutsList}>
              <h4 style={styles.payoutTitle}><Award size={14} /> Distribución de Premios</h4>
              {payouts.map((amount, idx) => (
                <div key={idx} style={styles.payoutItem}>
                  <span>{idx + 1}° Puesto ({tournament.payout_structure[idx]}%):</span>
                  <span style={styles.payoutVal}>${amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions Card */}
          <div className="glass-panel" style={styles.actionsCard}>
            <h4 style={styles.actionsTitle}>Acciones del Torneo</h4>
            <div style={styles.actionsButtons}>
              {tournament.status !== 'completed' && (
                <button 
                  className="btn btn-warning" 
                  style={styles.finishBtn}
                  onClick={handleManualCompleteTournament}
                >
                  Finalizar Torneo
                </button>
              )}
              <button 
                className="btn btn-danger" 
                style={styles.deleteBtn}
                onClick={handleDeleteTournament}
              >
                Eliminar Torneo
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Players Control Table */}
        <div className="glass-panel" style={styles.rightColumn}>
          <div style={styles.playersHeader}>
            <h3 style={styles.subTitle}><Users size={18} /> Jugadores Activos ({activePlayers.length})</h3>
            <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={fetchTournamentData}>
              Actualizar <RefreshCw size={14} />
            </button>
          </div>

          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.th}>Jugador</th>
                  <th style={styles.th}>Mesa / Asiento</th>
                  <th style={styles.th}>Recompras</th>
                  <th style={styles.th}>Add-On</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const isActive = p.status === 'active';
                  return (
                    <tr key={p.id} style={{ ...styles.tr, opacity: isActive ? 1 : 0.5 }}>
                      <td style={styles.td}>
                        <div style={styles.playerNameCol}>
                          <span style={{ fontWeight: isActive ? 700 : 400 }}>{getPlayerName(p)}</span>
                          {!isActive && <span style={styles.eliminatedTag}>Eliminado</span>}
                        </div>
                      </td>
                      <td style={styles.td}>
                        {isActive ? `Mesa ${p.table_number} / Silla ${p.seat_number}` : '-'}
                      </td>
                      <td style={styles.td}>
                        {p.rebuys_count}
                      </td>
                      <td style={styles.td}>
                        {p.has_add_on ? (
                          <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>SÍ</span>
                        ) : (
                          'NO'
                        )}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {isActive && tournament.status !== 'completed' ? (
                          <div style={styles.actions}>
                            <button 
                              className="btn btn-outline" 
                              style={styles.actionBtnSmall}
                              onClick={() => handleAddPlayerAction(p, 'rebuy')}
                              title="Registrar Recompra"
                            >
                              Recompra
                            </button>
                            {!p.has_add_on && (
                              <button 
                                className="btn btn-outline" 
                                style={styles.actionBtnSmall}
                                onClick={() => handleAddPlayerAction(p, 'addon')}
                                title="Registrar Add-On"
                              >
                                Add-On
                              </button>
                            )}
                            <button 
                              className="btn btn-danger" 
                              style={{ ...styles.actionBtnSmall, color: 'white' }}
                              onClick={() => handleAddPlayerAction(p, 'eliminate')}
                              title="Eliminar"
                            >
                              Eliminar
                            </button>
                          </div>
                        ) : (
                          <span style={styles.finishedLabel}>
                            {p.elimination_position ? `${p.elimination_position}° Posición` : '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Activity Feed Section */}
      <div className="glass-panel" style={styles.logsSection}>
        <h3 style={styles.subTitle}>Registro de Actividad</h3>
        <div style={styles.logsContainer}>
          {logs.map((log) => (
            <div key={log.id} style={styles.logRow}>
              <span style={styles.logTime}>
                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span style={{ 
                ...styles.logTag,
                backgroundColor: 
                  log.event_type === 'elimination' ? 'rgba(239, 68, 68, 0.15)' :
                  log.event_type === 'rebuy' ? 'rgba(245, 158, 11, 0.15)' :
                  log.event_type === 'addon' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color:
                  log.event_type === 'elimination' ? '#ef4444' :
                  log.event_type === 'rebuy' ? '#f59e0b' :
                  log.event_type === 'addon' ? '#10b981' : '#94a3b8'
              }}>
                {log.event_type.toUpperCase()}
              </span>
              <span style={styles.logMessage}>
                {log.event_type === 'elimination' && `Jugador ${log.payload.player_name} fue eliminado en la posición #${log.payload.position}`}
                {log.event_type === 'rebuy' && `Jugador ${log.payload.player_name} realizó recompra #${log.payload.count}`}
                {log.event_type === 'addon' && `Jugador ${log.payload.player_name} realizó add-on`}
                {log.event_type === 'level_change' && `Nivel cambiado a #${log.payload.level} (${log.payload.small_blind}/${log.payload.big_blind})`}
                {log.event_type === 'timer_action' && log.payload.message}
              </span>
            </div>
          ))}
          {logs.length === 0 && <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No hay actividad registrada.</div>}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    padding: '20px 0',
  },
  loadingContainer: {
    height: '60vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    color: 'var(--color-text-secondary)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    padding: '8px 16px',
    fontSize: '0.85rem',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 700,
  },
  balancingAlertCard: {
    padding: '16px 24px',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  balancingText: {
    fontSize: '0.92rem',
    fontWeight: 700,
    color: 'var(--color-secondary)',
  },
  controlGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.6fr',
    gap: '30px',
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  clockCard: {
    padding: '30px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  levelHeader: {
    fontSize: '0.95rem',
    fontWeight: 800,
    letterSpacing: '0.15em',
    color: 'var(--color-text-secondary)',
  },
  timerDisplay: {
    fontSize: '4.8rem',
    fontWeight: 800,
    fontFamily: 'monospace',
    lineHeight: 1,
    letterSpacing: '-0.02em',
    color: 'var(--color-text-primary)',
  },
  blindsDisplay: {
    fontSize: '1.8rem',
    fontWeight: 700,
    color: 'var(--color-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  anteLabel: {
    fontSize: '1.1rem',
    color: 'var(--color-text-secondary)',
  },
  clockControllers: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    margin: '10px 0',
  },
  controllerBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-color)',
    color: 'var(--color-text-primary)',
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  playBtn: {
    border: 'none',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  nextLevelInfo: {
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '12px',
    width: '100%',
  },
  statsCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.95rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
    paddingBottom: '8px',
  },
  statVal: {
    fontWeight: 700,
  },
  payoutsList: {
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    background: 'rgba(255, 255, 255, 0.01)',
    padding: '16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255, 255, 255, 0.03)',
  },
  payoutTitle: {
    fontSize: '0.85rem',
    fontWeight: 750,
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  payoutItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.85rem',
  },
  payoutVal: {
    fontWeight: 700,
    color: 'var(--color-secondary)',
  },
  rightColumn: {
    padding: '30px',
  },
  playersHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  subTitle: {
    fontSize: '1.15rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  tableScroll: {
    maxHeight: '520px',
    overflowY: 'auto',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  tableHeaderRow: {
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-darker)',
  },
  th: {
    padding: '12px 14px',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
  },
  tr: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
  },
  td: {
    padding: '12px 14px',
    fontSize: '0.85rem',
    verticalAlign: 'middle',
  },
  playerNameCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  eliminatedTag: {
    padding: '2px 6px',
    borderRadius: '4px',
    background: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    fontSize: '0.7rem',
    fontWeight: 700,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '6px',
  },
  actionBtnSmall: {
    padding: '6px 12px',
    fontSize: '0.75rem',
    fontWeight: 650,
    borderRadius: '4px',
  },
  finishedLabel: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    fontWeight: 600,
  },
  logsSection: {
    padding: '30px',
    marginTop: '10px',
  },
  logsContainer: {
    maxHeight: '160px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '16px',
    border: '1px solid var(--border-color)',
    padding: '12px',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(0, 0, 0, 0.15)',
  },
  logRow: {
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
    paddingBottom: '6px',
  },
  logTime: {
    color: 'var(--color-text-muted)',
    fontFamily: 'monospace',
  },
  logTag: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: 750,
  },
  logMessage: {
    color: 'var(--color-text-secondary)',
  },
  actionsCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginTop: '16px',
    borderColor: 'rgba(239, 68, 68, 0.1)',
  },
  actionsTitle: {
    fontSize: '0.9rem',
    fontWeight: 750,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    margin: 0,
  },
  actionsButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  finishBtn: {
    width: '100%',
    padding: '12px',
    fontWeight: 700,
    borderRadius: '8px',
    cursor: 'pointer',
    backgroundColor: '#d97706',
    borderColor: '#d97706',
    color: '#ffffff',
  },
  deleteBtn: {
    width: '100%',
    padding: '12px',
    fontWeight: 700,
    borderRadius: '8px',
    cursor: 'pointer',
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
    color: '#ffffff',
  },
};
