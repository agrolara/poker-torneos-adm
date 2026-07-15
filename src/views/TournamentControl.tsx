import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { Tournament, TournamentPlayer, Level, BlindStructure, TournamentLog, Player } from '../types';
import { Play, Pause, FastForward, Rewind, Users, Award, ShieldAlert, Tv, ArrowLeft, RefreshCw, Shuffle, Undo2, RotateCcw, AlertTriangle, Plus } from 'lucide-react';

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
  
  // Late registration states
  const [showLateModal, setShowLateModal] = useState(false);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedLatePlayerId, setSelectedLatePlayerId] = useState('');
  const [lateGuestName, setLateGuestName] = useState('');
  const [isSubmittingLate, setIsSubmittingLate] = useState(false);
  
  // Timer state (local replica for speed)
  const [secondsRemaining, setSecondsRemaining] = useState(initialTournament.seconds_remaining);
  const [isRunning, setIsRunning] = useState(initialTournament.is_timer_running);
  const [controlViewMode, setControlViewMode] = useState<'list' | 'visual'>('visual');

  const getSeatPosition = (seatIndex: number, totalSeats: number) => {
    // Offset by -90 degrees so seat 1 is at the top center
    const angle = (seatIndex * (360 / totalSeats) - 90) * (Math.PI / 180);
    // Oval radius
    const rx = 40; // horizontal radius in %
    const ry = 33; // vertical radius in %
    const x = 50 + rx * Math.cos(angle);
    const y = 50 + ry * Math.sin(angle);
    return { left: `${x}%`, top: `${y}%` };
  };
  const [currentLevelIdx, setCurrentLevelIdx] = useState(initialTournament.current_level_index);
  
  // Seating balancing recommendation
  const [balancingAlert, setBalancingAlert] = useState<string | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; player: TournamentPlayer | null; action: string }>({ show: false, player: null, action: '' });

  // Undo toast state
  const [undoToast, setUndoToast] = useState<{ show: boolean; message: string; undoFn: (() => Promise<void>) | null; timer: ReturnType<typeof setTimeout> | null }>({ show: false, message: '', undoFn: null, timer: null });
  const undoToastRef = useRef(undoToast);
  undoToastRef.current = undoToast;
  
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
        is_break: activeLevel?.is_break || false,
        duration_minutes: activeLevel?.duration || 0,
        level_label: activeLevel?.is_break ? 'DESCANSO' : `NIVEL ${activeLevel?.level || 1}`
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
    const lvls = getLevelsArray();
    const nextIdx = currentLevelIdx + 1;
    if (nextIdx < lvls.length) {
      const nextLevel = lvls[nextIdx];
      setCurrentLevelIdx(nextIdx);
      setSecondsRemaining(nextLevel.duration * 60);
      
      // Voice synthesis announcement
      if (nextLevel.is_break) {
        speakAnnounce(`¡Tiempo de descanso! Iniciamos un descanso de ${nextLevel.duration} minutos.`);
        addLog('level_change', { level: 0, small_blind: 0, big_blind: 0, is_break: true });
      } else {
        speakAnnounce(`¡Ciegas arriba! Nivel ${nextLevel.level}. Ciegas: ${nextLevel.small_blind} y ${nextLevel.big_blind}. Ante de ${nextLevel.ante}`);
        addLog('level_change', { level: nextLevel.level, small_blind: nextLevel.small_blind, big_blind: nextLevel.big_blind });
      }

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
    const lvls = getLevelsArray();
    const prevIdx = currentLevelIdx - 1;
    const prevLevel = lvls[prevIdx];
    setCurrentLevelIdx(prevIdx);
    setSecondsRemaining(prevLevel.duration * 60);
    
    if (prevLevel.is_break) {
      addLog('level_change', { level: 0, small_blind: 0, big_blind: 0, is_break: true, direction: 'back' });
    } else {
      addLog('level_change', { level: prevLevel.level, small_blind: prevLevel.small_blind, big_blind: prevLevel.big_blind, direction: 'back' });
    }

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

  const showUndoToast = (message: string, undoFn: () => Promise<void>) => {
    // Clear previous toast timer
    if (undoToastRef.current.timer) clearTimeout(undoToastRef.current.timer);
    const timer = setTimeout(() => {
      setUndoToast({ show: false, message: '', undoFn: null, timer: null });
    }, 15000);
    setUndoToast({ show: true, message, undoFn, timer });
  };

  const dismissUndoToast = () => {
    if (undoToastRef.current.timer) clearTimeout(undoToastRef.current.timer);
    setUndoToast({ show: false, message: '', undoFn: null, timer: null });
  };

  const handleAddPlayerAction = async (player: TournamentPlayer, type: 'rebuy' | 'addon' | 'eliminate') => {
    if (tournament.status === 'completed') return;
    // For eliminations, show confirmation modal first
    if (type === 'eliminate') {
      setConfirmModal({ show: true, player, action: 'eliminate' });
      return;
    }

    try {
      if (type === 'rebuy') {
        const newCount = player.rebuys_count + 1;
        const { error } = await supabase
          .from('tournament_players')
          .update({ rebuys_count: newCount })
          .eq('id', player.id);
        
        if (error) throw error;
        addLog('rebuy', { player_name: getPlayerName(player), count: newCount });

        // Undo toast for rebuy
        const prevCount = player.rebuys_count;
        showUndoToast(`Recompra #${newCount} registrada para ${getPlayerName(player)}`, async () => {
          await supabase.from('tournament_players').update({ rebuys_count: prevCount }).eq('id', player.id);
          addLog('correction', { message: `Recompra #${newCount} de ${getPlayerName(player)} fue deshecha` });
          fetchTournamentData();
        });
      } else if (type === 'addon') {
        const { error } = await supabase
          .from('tournament_players')
          .update({ has_add_on: true })
          .eq('id', player.id);
        
        if (error) throw error;
        addLog('addon', { player_name: getPlayerName(player) });

        // Undo toast for addon
        showUndoToast(`Add-On registrado para ${getPlayerName(player)}`, async () => {
          await supabase.from('tournament_players').update({ has_add_on: false }).eq('id', player.id);
          addLog('correction', { message: `Add-On de ${getPlayerName(player)} fue deshecho` });
          fetchTournamentData();
        });
      }
      
      // Reload players and logs
      fetchTournamentData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmElimination = async () => {
    if (tournament.status === 'completed') return;
    const player = confirmModal.player;
    if (!player) return;
    setConfirmModal({ show: false, player: null, action: '' });

    try {
      const activeCount = players.filter(p => p.status === 'active').length;
      const prevTable = player.table_number;
      const prevSeat = player.seat_number;

      const { error } = await supabase
        .from('tournament_players')
        .update({ 
          status: 'eliminated',
          elimination_position: activeCount
        })
        .eq('id', player.id);
      
      if (error) throw error;
      
      speakAnnounce(`${getPlayerName(player)} ha sido eliminado en la posición ${activeCount}`);
      addLog('elimination', { player_name: getPlayerName(player), position: activeCount });

      // Undo toast for elimination
      showUndoToast(`${getPlayerName(player)} eliminado en posición #${activeCount}`, async () => {
        await supabase.from('tournament_players').update({ 
          status: 'active', 
          elimination_position: null,
          table_number: prevTable,
          seat_number: prevSeat
        }).eq('id', player.id);
        addLog('correction', { message: `Eliminación de ${getPlayerName(player)} fue deshecha. Restituido a Mesa ${prevTable} / Silla ${prevSeat}` });
        fetchTournamentData();
      });

      if (activeCount === 2) {
        handleCompleteTournament(player.id);
      }
      
      fetchTournamentData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestorePlayer = async (player: TournamentPlayer) => {
    if (tournament.status === 'completed') return;
    try {
      // Find an empty seat on the table with the fewest players
      const activePs = players.filter(p => p.status === 'active');
      const tableCounts: Record<number, number> = {};
      activePs.forEach(p => {
        if (p.table_number) tableCounts[p.table_number] = (tableCounts[p.table_number] || 0) + 1;
      });
      
      let targetTable = 1;
      let minCount = Infinity;
      Object.entries(tableCounts).forEach(([t, c]) => {
        if (c < minCount) { minCount = c; targetTable = Number(t); }
      });

      const occupiedSeats = new Set(activePs.filter(p => p.table_number === targetTable).map(p => p.seat_number));
      let emptySeat = 1;
      for (let s = 1; s <= tournament.max_players_per_table; s++) {
        if (!occupiedSeats.has(s)) { emptySeat = s; break; }
      }

      const { error } = await supabase
        .from('tournament_players')
        .update({ 
          status: 'active', 
          elimination_position: null,
          table_number: targetTable,
          seat_number: emptySeat
        })
        .eq('id', player.id);
      
      if (error) throw error;

      addLog('correction', { message: `${getPlayerName(player)} fue restituido al torneo (Mesa ${targetTable} / Silla ${emptySeat})` });
      speakAnnounce(`${getPlayerName(player)} ha sido restituido al torneo`);
      fetchTournamentData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRevertLog = async (log: TournamentLog) => {
    const playerName = log.payload?.player_name;
    if (!playerName && !log.payload?.message) return;

    try {
      if (log.event_type === 'elimination') {
        // Find the eliminated player by name
        const player = players.find(p => getPlayerName(p) === playerName && p.status === 'eliminated');
        if (!player) { alert(`No se encontró al jugador eliminado "${playerName}".`); return; }
        await handleRestorePlayer(player);
      } else if (log.event_type === 'rebuy') {
        const player = players.find(p => getPlayerName(p) === playerName);
        if (!player) { alert(`No se encontró al jugador "${playerName}".`); return; }
        if (player.rebuys_count <= 0) { alert('Este jugador no tiene recompras para revertir.'); return; }
        await supabase.from('tournament_players').update({ rebuys_count: player.rebuys_count - 1 }).eq('id', player.id);
        addLog('correction', { message: `Recompra #${log.payload.count} de ${playerName} revertida desde el historial` });
        fetchTournamentData();
      } else if (log.event_type === 'addon') {
        const player = players.find(p => getPlayerName(p) === playerName);
        if (!player) { alert(`No se encontró al jugador "${playerName}".`); return; }
        if (!player.has_add_on) { alert('Este jugador ya no tiene add-on registrado.'); return; }
        await supabase.from('tournament_players').update({ has_add_on: false }).eq('id', player.id);
        addLog('correction', { message: `Add-On de ${playerName} revertido desde el historial` });
        fetchTournamentData();
      } else if (log.event_type === 'balancing') {
        // Balancing logs contain a message like "Mesa balanceada: Se movió a PLAYER de Mesa X a Mesa Y (Silla Z)"
        alert('Para revertir un balanceo, utiliza los selectores de Mesa/Silla en la vista de Lista para mover al jugador manualmente.');
      }
    } catch (e) {
      console.error('Error reverting log:', e);
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

    // Check if tables should merge
    const totalActive = active.length;
    const maxCapacity = tournament.max_players_per_table;
    const currentTableCount = tables.length;
    const neededTables = Math.ceil(totalActive / maxCapacity);

    // Sort tables by count ascending to find the smallest
    const sortedTables = [...tables].sort((a, b) => tableCounts[a] - tableCounts[b]);
    const smallestTable = sortedTables[0];
    const smallestCount = tableCounts[smallestTable];

    if (neededTables < currentTableCount) {
      // We can consolidate: the smallest table fits into others
      const otherTables = sortedTables.slice(1);
      const otherCapacity = otherTables.reduce((sum, t) => sum + (maxCapacity - tableCounts[t]), 0);
      if (smallestCount <= otherCapacity) {
        setBalancingAlert(`💥 Unir Mesas: Mesa ${smallestTable} tiene solo ${smallestCount} jugador${smallestCount === 1 ? '' : 'es'}. Se pueden redistribuir a las ${otherTables.length} mesa${otherTables.length === 1 ? '' : 's'} restante${otherTables.length === 1 ? '' : 's'}.`);
      } else {
        setBalancingAlert(`⚠️ Romper Mesa ${smallestTable}: Mover todos los jugadores a asientos libres.`);
      }
    } else if (smallestCount <= 3 && currentTableCount > 1) {
      // Even if neededTables == currentTableCount, if a table has <= 3, suggest merge if possible
      const otherTables = sortedTables.slice(1);
      const otherCapacity = otherTables.reduce((sum, t) => sum + (maxCapacity - tableCounts[t]), 0);
      if (smallestCount <= otherCapacity) {
        setBalancingAlert(`💥 Unir Mesas: Mesa ${smallestTable} tiene solo ${smallestCount} jugador${smallestCount === 1 ? '' : 'es'}. Se pueden fusionar con las demás mesas.`);
      } else if (diff >= 2) {
        setBalancingAlert(`⚠️ Desbalance: Mover un jugador de Mesa ${maxTable} (${tableCounts[maxTable]} jug.) a Mesa ${minTable} (${tableCounts[minTable]} jug.).`);
      } else {
        setBalancingAlert(null);
      }
    } else if (diff >= 2) {
      setBalancingAlert(`⚠️ Desbalance: Mover un jugador de Mesa ${maxTable} (${tableCounts[maxTable]} jug.) a Mesa ${minTable} (${tableCounts[minTable]} jug.).`);
    } else {
      setBalancingAlert(null);
    }
  };

  const handleMergeTables = async () => {
    if (tournament.status === 'completed') return;
    try {
      const active = players.filter(p => p.status === 'active');
      const tableCounts: Record<number, number> = {};
      active.forEach(p => {
        if (p.table_number) tableCounts[p.table_number] = (tableCounts[p.table_number] || 0) + 1;
      });

      const tables = Object.keys(tableCounts).map(Number);
      if (tables.length <= 1) return;

      // Find the smallest table
      const sortedTables = [...tables].sort((a, b) => tableCounts[a] - tableCounts[b]);
      const tableToBreak = sortedTables[0];
      const playersToMove = active.filter(p => p.table_number === tableToBreak);

      if (playersToMove.length === 0) return;

      // Distribute players to other tables, filling the one with fewest players first
      const otherTables = sortedTables.slice(1);
      const movedPlayers: string[] = [];

      for (const player of playersToMove) {
        // Recalculate counts after each move
        const currentCounts: Record<number, number> = {};
        // Count from already-moved state
        active.forEach(p => {
          if (p.table_number && p.table_number !== tableToBreak) {
            currentCounts[p.table_number] = (currentCounts[p.table_number] || 0) + 1;
          }
        });
        // Add already-moved players
        movedPlayers.forEach(() => {}); // counts already reflect moves via DB

        // Find the table with fewest players among other tables
        let targetTable = otherTables[0];
        let minCount = Infinity;
        for (const t of otherTables) {
          const count = currentCounts[t] || 0;
          if (count < minCount && count < tournament.max_players_per_table) {
            minCount = count;
            targetTable = t;
          }
        }

        // Find empty seat on target table
        const seatsOnTarget = new Set(
          active.filter(p => p.table_number === targetTable).map(p => p.seat_number)
        );
        // Add seats of players already moved to this target
        let emptySeat = 1;
        for (let s = 1; s <= tournament.max_players_per_table; s++) {
          if (!seatsOnTarget.has(s)) { emptySeat = s; break; }
        }

        // Move player
        const { error } = await supabase
          .from('tournament_players')
          .update({ table_number: targetTable, seat_number: emptySeat })
          .eq('id', player.id);

        if (error) throw error;

        // Update local reference so next iteration knows this seat is taken
        player.table_number = targetTable;
        player.seat_number = emptySeat;
        movedPlayers.push(player.id);
        // Add seat to occupied set for next iteration
        seatsOnTarget.add(emptySeat);
        // Update count
        tableCounts[targetTable] = (tableCounts[targetTable] || 0) + 1;
      }

      const names = playersToMove.map(p => getPlayerName(p)).join(', ');
      addLog('balancing', { message: `Mesa ${tableToBreak} fusionada. ${playersToMove.length} jugador${playersToMove.length === 1 ? '' : 'es'} redistribuido${playersToMove.length === 1 ? '' : 's'}: ${names}` });
      speakAnnounce(`Mesa ${tableToBreak} ha sido cerrada. ${playersToMove.length} jugadores fueron redistribuidos.`);

      await fetchTournamentData();
    } catch (e) {
      console.error('Error merging tables:', e);
    }
  };

  const handleOpenTV = () => {
    window.open(`?tv=true`, '_blank', 'width=1000,height=700,menubar=no,toolbar=no,location=no');
  };

  const handleMovePlayerTable = async (playerTournamentId: string, newTable: number) => {
    if (tournament.status === 'completed') return;
    try {
      const { error } = await supabase
        .from('tournament_players')
        .update({ table_number: newTable })
        .eq('id', playerTournamentId);

      if (error) throw error;
      await fetchTournamentData();
    } catch (err) {
      console.error('Error moving player table:', err);
    }
  };

  const handleMovePlayerSeat = async (playerTournamentId: string, newSeat: number) => {
    if (tournament.status === 'completed') return;
    try {
      const { error } = await supabase
        .from('tournament_players')
        .update({ seat_number: newSeat })
        .eq('id', playerTournamentId);

      if (error) throw error;
      await fetchTournamentData();
    } catch (err) {
      console.error('Error moving player seat:', err);
    }
  };

  const handleAutoBalance = async () => {
    if (tournament.status === 'completed') return;
    try {
      const activePlayers = players.filter(pl => pl.status === 'active');
      const tableCounts: Record<number, number> = {};
      activePlayers.forEach(pl => {
        if (pl.table_number) {
          tableCounts[pl.table_number] = (tableCounts[pl.table_number] || 0) + 1;
        }
      });

      const tables = Object.keys(tableCounts).map(Number);
      if (tables.length < 2) return;

      let maxTable = tables[0];
      let minTable = tables[0];
      
      tables.forEach(t => {
        if (tableCounts[t] > tableCounts[maxTable]) maxTable = t;
        if (tableCounts[t] < tableCounts[minTable]) minTable = t;
      });

      if (tableCounts[maxTable] - tableCounts[minTable] <= 1) {
        alert('Las mesas ya están balanceadas.');
        return;
      }

      const playerToMove = activePlayers.find(pl => pl.table_number === maxTable);
      if (!playerToMove) return;

      const occupiedSeats = new Set(activePlayers.filter(pl => pl.table_number === minTable).map(pl => pl.seat_number));
      let emptySeat = 1;
      for (let s = 1; s <= tournament.max_players_per_table; s++) {
        if (!occupiedSeats.has(s)) {
          emptySeat = s;
          break;
        }
      }

      const { error } = await supabase
        .from('tournament_players')
        .update({ 
          table_number: minTable,
          seat_number: emptySeat
        })
        .eq('id', playerToMove.id);

      if (error) throw error;

      await supabase.from('tournament_logs').insert({
        tournament_id: tournament.id,
        event_type: 'balancing',
        payload: {
          message: `Mesa balanceada: Se movió a ${getPlayerName(playerToMove)} de Mesa ${maxTable} a Mesa ${minTable} (Silla ${emptySeat})`
        }
      });

      await fetchTournamentData();
    } catch (err) {
      console.error('Error auto balancing tables:', err);
    }
  };

  const openLateRegistrationModal = async () => {
    try {
      const { data } = await supabase.from('players').select('*').order('name', { ascending: true });
      setAllPlayers(data || []);
      setSelectedLatePlayerId('');
      setLateGuestName('');
      setShowLateModal(true);
    } catch (err) {
      console.error('Error fetching directory players:', err);
    }
  };

  const handleAddLatePlayer = async () => {
    if (tournament.status === 'completed') return;
    const isGuest = !selectedLatePlayerId;
    if (isGuest && !lateGuestName.trim()) {
      alert('Por favor, ingresa el nombre del invitado.');
      return;
    }

    setIsSubmittingLate(true);
    try {
      // Find empty seat
      const activePs = players.filter(p => p.status === 'active');
      const maxPlayers = tournament.max_players_per_table;

      const tableCounts: Record<number, number> = {};
      activePs.forEach(p => {
        if (p.table_number) {
          tableCounts[p.table_number] = (tableCounts[p.table_number] || 0) + 1;
        }
      });

      let targetTable: number | null = null;
      let targetSeat: number | null = null;

      const activeTables = Object.keys(tableCounts).map(Number).sort((a,b) => a-b);

      // Find first table with < maxPlayers
      for (const t of activeTables) {
        if (tableCounts[t] < maxPlayers) {
          targetTable = t;
          break;
        }
      }

      // If all are full or none exist, create table
      if (targetTable === null) {
        targetTable = activeTables.length > 0 ? Math.max(...activeTables) + 1 : 1;
      }

      // Find first seat
      const seatsAtTable = new Set(activePs.filter(p => p.table_number === targetTable).map(p => p.seat_number));
      for (let s = 1; s <= maxPlayers; s++) {
        if (!seatsAtTable.has(s)) {
          targetSeat = s;
          break;
        }
      }
      if (targetSeat === null) targetSeat = 1;

      // Guest / Player properties
      const newPlayerRow = {
        tournament_id: tournament.id,
        player_id: isGuest ? null : selectedLatePlayerId,
        guest_name: isGuest ? lateGuestName.trim() : null,
        status: 'active',
        rebuys_count: 0,
        has_add_on: false,
        table_number: targetTable,
        seat_number: targetSeat,
        elimination_position: null,
        payout_amount: 0
      };

      const { error } = await supabase.from('tournament_players').insert(newPlayerRow);
      if (error) throw error;

      const addedName = isGuest ? lateGuestName.trim() : (allPlayers.find(p => p.id === selectedLatePlayerId)?.name || 'Jugador');
      addLog('timer_action', { message: `Registro Tardío: ${addedName} ingresó al torneo en Mesa ${targetTable} / Silla ${targetSeat}` });
      speakAnnounce(`${addedName} ha ingresado como registro tardío en la mesa ${targetTable}`);

      setShowLateModal(false);
      fetchTournamentData();
    } catch (err) {
      console.error('Error adding late player:', err);
      alert('Error al agregar al jugador.');
    } finally {
      setIsSubmittingLate(false);
    }
  };

  const getLevelsArray = (): Level[] => {
    if (!structure) return [];
    if (Array.isArray(structure.levels)) return structure.levels;
    return (structure.levels as any).levels || [];
  };

  // Helper selectors
  const getCurrentLevel = (): Level | null => {
    const lvls = getLevelsArray();
    return lvls[currentLevelIdx] || null;
  };

  const getNextLevel = (): Level | null => {
    const lvls = getLevelsArray();
    return lvls[currentLevelIdx + 1] || null;
  };

  const getPlayerName = (p: TournamentPlayer) => {
    return p.guest_name || p.player?.name || 'Jugador Invitado';
  };

  const calculateFinancials = () => {
    const buyInsCount = players.length;
    const rebuysCount = players.reduce((acc, p) => acc + p.rebuys_count, 0);
    const addOnsCount = players.filter(p => p.has_add_on).length;

    const rakeTotal = buyInsCount * (tournament.rake_amount || 0);

    const prizePool = 
      (buyInsCount * (tournament.buy_in_amount - (tournament.rake_amount || 0))) +
      (rebuysCount * tournament.rebuy_amount) +
      (addOnsCount * tournament.add_on_amount);

    const payouts = tournament.payout_structure.map(pct => Math.round((prizePool * pct) / 100));

    return { prizePool, payouts, buyInsCount, rebuysCount, addOnsCount, rakeTotal };
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
  const activeTableNumbers = Array.from(new Set(activePlayers.filter(p => p.table_number !== null).map(p => p.table_number as number))).sort((a,b) => a-b);
  const { prizePool, payouts, rakeTotal } = calculateFinancials();

  const sortedWinners = [...players]
    .filter(p => p.elimination_position !== null)
    .sort((a, b) => (a.elimination_position || 99) - (b.elimination_position || 99));

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
          
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {balancingAlert.includes('Unir Mesas') && (
              <button 
                className="btn" 
                style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 700 }} 
                onClick={handleMergeTables}
              >
                Unir Mesas <Shuffle size={12} />
              </button>
            )}
            {balancingAlert.includes('Desbalance') && (
              <button 
                className="btn btn-accent" 
                style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }} 
                onClick={handleAutoBalance}
              >
                Balancear Mesa <Shuffle size={12} />
              </button>
            )}
            <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={fetchTournamentData}>
              Recalcular <RefreshCw size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Control clock on Left, Players grid on Right */}
      <div className="control-main-grid" style={styles.controlGrid}>
        {/* Left Side: Clock Card and Stats */}
        <div style={styles.leftColumn}>
          {/* Clock Display Card */}
          <div className="glass-panel" style={{ ...styles.clockCard, borderColor: isRunning ? 'var(--color-primary)' : 'var(--border-color)' }}>
            {tournament.status === 'completed' ? (
              <div style={styles.completedHeaderCard}>
                <div style={styles.completedBadge}><Award size={20} color="#f59e0b" /> TORNEO CONCLUIDO</div>
                
                {/* Podium representation */}
                <div style={styles.podiumContainer}>
                  {/* 2nd Place */}
                  {sortedWinners[1] && (
                    <div style={styles.podiumStep2}>
                      <div style={styles.podiumAvatar}>🥈</div>
                      <div style={styles.podiumName}>{getPlayerName(sortedWinners[1])}</div>
                      <div style={styles.podiumPrize}>${(sortedWinners[1].payout_amount || payouts[1] || 0).toLocaleString()}</div>
                      <div style={styles.podiumLabel}>2° Puesto</div>
                    </div>
                  )}

                  {/* 1st Place */}
                  {sortedWinners[0] && (
                    <div style={styles.podiumStep1}>
                      <div style={styles.podiumAvatarMain}>🏆</div>
                      <div style={styles.podiumNameMain}>{getPlayerName(sortedWinners[0])}</div>
                      <div style={styles.podiumPrizeMain}>${(sortedWinners[0].payout_amount || payouts[0] || 0).toLocaleString()}</div>
                      <div style={styles.podiumLabelMain}>GANADOR</div>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {sortedWinners[2] && (
                    <div style={styles.podiumStep3}>
                      <div style={styles.podiumAvatar}>🥉</div>
                      <div style={styles.podiumName}>{getPlayerName(sortedWinners[2])}</div>
                      <div style={styles.podiumPrize}>${(sortedWinners[2].payout_amount || payouts[2] || 0).toLocaleString()}</div>
                      <div style={styles.podiumLabel}>3° Puesto</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div style={styles.levelHeader}>
                  {activeLevel?.is_break ? 'DESCANSO' : `NIVEL ${activeLevel?.level || 1}`}
                </div>
                
                <div className="control-timer-display" style={styles.timerDisplay}>
                  {formatTime(secondsRemaining)}
                </div>

                <div style={{
                  ...styles.blindsDisplay,
                  color: activeLevel?.is_break ? '#10b981' : '#ffffff',
                  fontSize: activeLevel?.is_break ? '1.8rem' : '2.2rem'
                }}>
                  {activeLevel?.is_break ? (
                    'TIEMPO DE BREAK'
                  ) : (
                    <>${activeLevel?.small_blind || 0} / ${activeLevel?.big_blind || 0}
                    {activeLevel?.ante ? <span style={styles.anteLabel}> (Ante: ${activeLevel.ante})</span> : ''}</>
                  )}
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
                    {nextLevel.is_break ? (
                      <>Próximo: <span style={{ color: '#10b981' }}>Descanso / Break ({nextLevel.duration} min)</span></>
                    ) : (
                      <>Siguiente Nivel: <span>${nextLevel.small_blind}/${nextLevel.big_blind}</span> (Ante: ${nextLevel.ante})</>
                    )}
                  </div>
                )}
              </>
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
              <span>Monto a Repartir:</span>
              <span style={{ ...styles.statVal, color: 'var(--color-primary)' }}>${prizePool.toLocaleString()}</span>
            </div>
            {tournament.rake_amount > 0 && (
              <div style={styles.statRow}>
                <span>Rake de Fecha:</span>
                <span style={{ ...styles.statVal, color: 'var(--color-secondary)' }}>${rakeTotal.toLocaleString()}</span>
              </div>
            )}
            
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
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {tournament.status !== 'completed' && (
                <button 
                  className="btn btn-primary" 
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '0.75rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    marginRight: '6px'
                  }} 
                  onClick={openLateRegistrationModal}
                >
                  <Plus size={14} /> Registro Tardío
                </button>
              )}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <button 
                  className="btn" 
                  style={{ 
                    padding: '4px 10px', 
                    fontSize: '0.75rem', 
                    borderRadius: '4px',
                    background: controlViewMode === 'visual' ? 'var(--color-primary)' : 'transparent',
                    color: controlViewMode === 'visual' ? '#000000' : 'var(--color-text-secondary)',
                    border: 'none',
                    margin: 0
                  }}
                  onClick={() => setControlViewMode('visual')}
                >
                  Mesas Visual
                </button>
                <button 
                  className="btn" 
                  style={{ 
                    padding: '4px 10px', 
                    fontSize: '0.75rem', 
                    borderRadius: '4px',
                    background: controlViewMode === 'list' ? 'var(--color-primary)' : 'transparent',
                    color: controlViewMode === 'list' ? '#000000' : 'var(--color-text-secondary)',
                    border: 'none',
                    margin: 0
                  }}
                  onClick={() => setControlViewMode('list')}
                >
                  Lista
                </button>
              </div>
              <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={fetchTournamentData}>
                Actualizar <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {controlViewMode === 'visual' ? (
            <div style={styles.tablesVisualContainer}>
              {activeTableNumbers.map((tableNum) => {
                const playersAtTable = activePlayers.filter(p => p.table_number === tableNum);
                
                return (
                  <div key={tableNum} style={styles.tableCard}>
                    <div style={styles.tableCardHeader}>
                      <h4 style={styles.tableTitle}>Mesa {tableNum}</h4>
                      <span style={styles.tableCountLabel}>{playersAtTable.length} Jugadores</span>
                    </div>

                    {/* Visual Table Wrapper */}
                    <div style={styles.visualTableWrapper}>
                      {/* Felt shape */}
                      <div style={styles.tableFelt}>
                        <div style={styles.feltCenter}>
                          <span style={styles.feltLabel}>{tournament.name}</span>
                          <span style={styles.feltSub}>Mesa {tableNum}</span>
                        </div>
                      </div>

                      {/* Seats */}
                      {Array.from({ length: tournament.max_players_per_table }).map((_, seatIdx) => {
                        const seatNum = seatIdx + 1;
                        const player = playersAtTable.find(p => p.seat_number === seatNum);
                        const pos = getSeatPosition(seatIdx, tournament.max_players_per_table);

                        return (
                          <div 
                            key={seatNum} 
                            style={{
                              ...styles.seatNode,
                              ...pos,
                            }}
                          >
                            {player ? (
                              <div 
                                style={{
                                  ...styles.seatActive,
                                  cursor: tournament.status === 'completed' ? 'default' : 'pointer'
                                }}
                                onClick={() => {
                                  if (tournament.status !== 'completed') {
                                    handleAddPlayerAction(player, 'eliminate');
                                  }
                                }}
                                title={tournament.status === 'completed' ? `Asiento ${seatNum}: ${getPlayerName(player)}` : `Asiento ${seatNum}: ${getPlayerName(player)} (Haz clic para acciones)`}
                              >
                                <div style={styles.seatAvatar}>
                                  {getPlayerName(player).substring(0, 2).toUpperCase()}
                                </div>
                                <div style={styles.seatNameBadge}>
                                  <span style={styles.seatPlayerName}>{getPlayerName(player)}</span>
                                  {player.rebuys_count > 0 && (
                                    <span style={styles.seatRebuys}>R:{player.rebuys_count}</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div style={styles.seatEmpty} title={`Asiento ${seatNum}: Vacío`}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{seatNum}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {activeTableNumbers.length === 0 && (
                <div style={styles.emptyState}>
                  No hay mesas activas. Registra jugadores e inicia el torneo.
                </div>
              )}
            </div>
          ) : (
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
                          {isActive ? (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <select 
                                value={p.table_number || ''} 
                                onChange={(e) => handleMovePlayerTable(p.id, Number(e.target.value))}
                                className="form-input"
                                style={{ padding: '4px 8px', fontSize: '0.8rem', width: '90px', background: 'rgba(3,7,18,0.4)', margin: 0 }}
                                disabled={tournament.status === 'completed'}
                              >
                                {Array.from({ length: Math.ceil(players.filter(pl => pl.status === 'active').length / tournament.max_players_per_table) }).map((_, i) => (
                                  <option key={i+1} value={i+1}>Mesa {i+1}</option>
                                ))}
                              </select>
                              <select 
                                value={p.seat_number || ''} 
                                onChange={(e) => handleMovePlayerSeat(p.id, Number(e.target.value))}
                                className="form-input"
                                style={{ padding: '4px 8px', fontSize: '0.8rem', width: '80px', background: 'rgba(3,7,18,0.4)', margin: 0 }}
                                disabled={tournament.status === 'completed'}
                              >
                                {Array.from({ length: tournament.max_players_per_table }).map((_, i) => (
                                  <option key={i+1} value={i+1}>Silla {i+1}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            '-'
                          )}
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
                          ) : p.status === 'eliminated' && tournament.status !== 'completed' ? (
                            <div style={styles.actions}>
                              <span style={styles.finishedLabel}>
                                {p.elimination_position ? `${p.elimination_position}° Posición` : '-'}
                              </span>
                              <button 
                                className="btn btn-outline" 
                                style={{ ...styles.actionBtnSmall, color: '#818cf8', borderColor: '#818cf8' }}
                                onClick={() => handleRestorePlayer(p)}
                                title="Restituir jugador al torneo"
                              >
                                <RotateCcw size={12} /> Restituir
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
          )}
        </div>
      </div>

      {/* Undo Toast */}
      {undoToast.show && (
        <div style={styles.undoToast}>
          <Undo2 size={16} color="#f59e0b" />
          <span style={{ flex: 1 }}>{undoToast.message}</span>
          <button 
            className="btn" 
            style={styles.undoBtn}
            onClick={async () => {
              if (undoToast.undoFn) await undoToast.undoFn();
              dismissUndoToast();
            }}
          >
            <RotateCcw size={13} /> Deshacer
          </button>
          <button 
            style={styles.undoDismiss}
            onClick={dismissUndoToast}
          >
            ✕
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && confirmModal.player && (
        <div style={styles.modalOverlay} onClick={() => setConfirmModal({ show: false, player: null, action: '' })}>
          <div style={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.confirmIcon}>
              <AlertTriangle size={32} color="#ef4444" />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem' }}>Confirmar Eliminación</h3>
            <p style={{ margin: '0 0 8px', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              ¿Estás seguro de que deseas eliminar a este jugador?
            </p>
            <div style={styles.confirmPlayerInfo}>
              <strong>{getPlayerName(confirmModal.player)}</strong>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Mesa {confirmModal.player.table_number} / Silla {confirmModal.player.seat_number}
              </span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Posición resultante: #{players.filter(p => p.status === 'active').length}°
              </span>
            </div>
            <div style={styles.confirmButtons}>
              <button 
                className="btn btn-outline" 
                style={{ flex: 1 }}
                onClick={() => setConfirmModal({ show: false, player: null, action: '' })}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-danger" 
                style={{ flex: 1, color: '#ffffff' }}
                onClick={handleConfirmElimination}
              >
                Sí, Eliminar
              </button>
            </div>
            <p style={{ margin: '8px 0 0', color: 'var(--color-text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
              Podrás deshacer esta acción durante 15 segundos después de confirmar.
            </p>
          </div>
        </div>
      )}

      {/* Late Registration Modal */}
      {showLateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowLateModal(false)}>
          <div style={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.confirmIcon}>
              <Plus size={32} color="var(--color-primary)" />
            </div>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem', color: '#ffffff' }}>Registro Tardío</h3>
            <p style={{ margin: '0 0 20px', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              Registra un nuevo jugador local o un invitado en una mesa activa.
            </p>

            {/* Selector de jugador del directorio */}
            <div className="form-group" style={{ textAlign: 'left', marginBottom: '16px' }}>
              <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '6px' }}>Jugador del Directorio</label>
              <select 
                className="form-input" 
                value={selectedLatePlayerId} 
                onChange={(e) => {
                  setSelectedLatePlayerId(e.target.value);
                  if (e.target.value) setLateGuestName('');
                }}
                style={{ width: '100%', background: 'rgba(3,7,18,0.5)' }}
              >
                <option value="">-- Seleccionar Jugador Local --</option>
                {allPlayers
                  .filter(dp => !players.some(p => p.player_id === dp.id))
                  .map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))
                }
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '12px 0', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
              <span style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', flex: 1 }}></span>
              <span style={{ padding: '0 10px' }}>O REGISTRAR COMO INVITADO</span>
              <span style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', flex: 1 }}></span>
            </div>

            {/* Input de Invitado */}
            <div className="form-group" style={{ textAlign: 'left', marginBottom: '24px' }}>
              <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '6px' }}>Nombre del Invitado</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ej. Juan Pérez" 
                value={lateGuestName}
                onChange={(e) => {
                  setLateGuestName(e.target.value);
                  if (e.target.value) setSelectedLatePlayerId('');
                }}
                style={{ width: '100%', background: 'rgba(3,7,18,0.5)' }}
              />
            </div>

            <div style={styles.confirmButtons}>
              <button 
                className="btn btn-outline" 
                style={{ flex: 1 }}
                onClick={() => setShowLateModal(false)}
                disabled={isSubmittingLate}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                onClick={handleAddLatePlayer}
                disabled={isSubmittingLate || (!selectedLatePlayerId && !lateGuestName.trim())}
              >
                {isSubmittingLate ? 'Registrando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  log.event_type === 'addon' ? 'rgba(16, 185, 129, 0.15)' :
                  log.event_type === 'correction' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color:
                  log.event_type === 'elimination' ? '#ef4444' :
                  log.event_type === 'rebuy' ? '#f59e0b' :
                  log.event_type === 'addon' ? '#10b981' :
                  log.event_type === 'correction' ? '#818cf8' : '#94a3b8'
              }}>
                {log.event_type === 'correction' ? 'CORRECCIÓN' : log.event_type.toUpperCase()}
              </span>
              <span style={styles.logMessage}>
                {log.event_type === 'elimination' && `Jugador ${log.payload.player_name} fue eliminado en la posición #${log.payload.position}`}
                {log.event_type === 'rebuy' && `Jugador ${log.payload.player_name} realizó recompra #${log.payload.count}`}
                {log.event_type === 'addon' && `Jugador ${log.payload.player_name} realizó add-on`}
                {log.event_type === 'level_change' && `Nivel cambiado a #${log.payload.level} (${log.payload.small_blind}/${log.payload.big_blind})`}
                {log.event_type === 'timer_action' && log.payload.message}
                {log.event_type === 'balancing' && log.payload.message}
                {log.event_type === 'correction' && log.payload.message}
              </span>
              {tournament.status !== 'completed' && ['elimination', 'rebuy', 'addon', 'balancing'].includes(log.event_type) && (
                <button
                  className="btn"
                  style={styles.revertLogBtn}
                  onClick={() => handleRevertLog(log)}
                  title="Revertir esta acción"
                >
                  <RotateCcw size={11} /> Revertir
                </button>
              )}
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
    flex: 1,
  },
  revertLogBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    padding: '3px 8px',
    fontSize: '0.7rem',
    fontWeight: 700,
    borderRadius: '4px',
    background: 'rgba(99, 102, 241, 0.1)',
    color: '#818cf8',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
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
  tablesVisualContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
    marginTop: '10px',
  },
  tableCard: {
    background: 'rgba(3, 7, 18, 0.25)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
  },
  tableCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  tableTitle: {
    fontSize: '1.1rem',
    fontWeight: 750,
  },
  tableCountLabel: {
    fontSize: '0.8rem',
    color: 'var(--color-primary)',
    fontWeight: 700,
    background: 'var(--color-primary-glow)',
    padding: '3px 8px',
    borderRadius: '100px',
  },
  visualTableWrapper: {
    position: 'relative',
    height: '240px',
    width: '100%',
    margin: '10px auto',
  },
  tableFelt: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '62%',
    height: '52%',
    background: 'radial-gradient(ellipse at center, #064e3b 0%, #022c22 100%)',
    border: '8px solid #1f2937',
    borderRadius: '100px',
    boxShadow: 'inset 0 0 15px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  feltCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feltLabel: {
    fontSize: '0.75rem',
    fontWeight: 800,
    color: '#ffffff',
    opacity: 0.15,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  feltSub: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: '#ffffff',
    opacity: 0.1,
  },
  seatNode: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatActive: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    transition: 'transform 0.15s ease',
  },
  seatAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
    color: '#000000',
    fontWeight: 800,
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
    border: '2px solid #ffffff',
  },
  seatNameBadge: {
    background: 'rgba(3, 7, 18, 0.85)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '4px',
    padding: '2px 6px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    maxWidth: '85px',
    overflow: 'hidden',
  },
  seatPlayerName: {
    fontSize: '0.7rem',
    fontWeight: 650,
    color: '#ffffff',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  seatRebuys: {
    fontSize: '0.6rem',
    fontWeight: 800,
    color: 'var(--color-secondary)',
  },
  seatEmpty: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.03)',
    border: '1px dashed rgba(255,255,255,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoToast: {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(3, 7, 18, 0.95)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '12px',
    padding: '12px 20px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
    minWidth: '320px',
    maxWidth: '580px',
    fontSize: '0.88rem',
    color: '#ffffff',
    backdropFilter: 'blur(10px)',
    animation: 'slideUp 0.3s ease',
  },
  undoBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 14px',
    fontSize: '0.8rem',
    fontWeight: 750,
    borderRadius: '6px',
    background: '#f59e0b',
    color: '#000000',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  undoDismiss: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '4px',
    lineHeight: 1,
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9998,
    backdropFilter: 'blur(4px)',
  },
  confirmModal: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px',
    maxWidth: '400px',
    width: '90%',
    textAlign: 'center',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
  },
  confirmIcon: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '12px',
  },
  confirmPlayerInfo: {
    background: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '16px',
  },
  confirmButtons: {
    display: 'flex',
    gap: '10px',
  },
  completedHeaderCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
    padding: '10px 0',
  },
  completedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    borderRadius: '20px',
    padding: '6px 16px',
    color: '#f59e0b',
    fontSize: '0.85rem',
    fontWeight: 750,
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  podiumContainer: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    marginTop: '5px',
  },
  podiumStep1: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0.03) 100%)',
    border: '1px solid rgba(245, 158, 11, 0.35)',
    borderRadius: '12px',
    padding: '14px 10px',
    width: '105px',
    minHeight: '135px',
    boxShadow: '0 8px 32px 0 rgba(245, 158, 11, 0.1)',
    order: 2,
  },
  podiumStep2: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'linear-gradient(135deg, rgba(226, 232, 240, 0.12) 0%, rgba(226, 232, 240, 0.02) 100%)',
    border: '1px solid rgba(226, 232, 240, 0.18)',
    borderRadius: '12px',
    padding: '10px 8px',
    width: '90px',
    minHeight: '110px',
    order: 1,
  },
  podiumStep3: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'linear-gradient(135deg, rgba(180, 83, 9, 0.12) 0%, rgba(180, 83, 9, 0.02) 100%)',
    border: '1px solid rgba(180, 83, 9, 0.18)',
    borderRadius: '12px',
    padding: '10px 8px',
    width: '90px',
    minHeight: '95px',
    order: 3,
  },
  podiumAvatarMain: {
    fontSize: '2rem',
    marginBottom: '6px',
    filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.4))',
  },
  podiumAvatar: {
    fontSize: '1.4rem',
    marginBottom: '4px',
  },
  podiumNameMain: {
    fontSize: '0.8rem',
    fontWeight: 750,
    color: '#ffffff',
    textAlign: 'center',
    width: '100%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  podiumName: {
    fontSize: '0.7rem',
    fontWeight: 650,
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
    width: '100%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  podiumPrizeMain: {
    fontSize: '0.9rem',
    fontWeight: 800,
    color: '#f59e0b',
    marginTop: '3px',
  },
  podiumPrize: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#e2e8f0',
    marginTop: '2px',
  },
  podiumLabelMain: {
    fontSize: '0.6rem',
    fontWeight: 800,
    color: '#f59e0b',
    textTransform: 'uppercase',
    marginTop: 'auto',
    letterSpacing: '0.5px',
  },
  podiumLabel: {
    fontSize: '0.55rem',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    marginTop: 'auto',
  },
};
