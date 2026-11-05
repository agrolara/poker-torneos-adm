import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { Tournament, TournamentPlayer, Level, BlindStructure, TournamentLog, Player } from '../types';
import { Play, Pause, FastForward, Rewind, Award, ShieldAlert, Tv, ArrowLeft, Shuffle, Undo2, RotateCcw, AlertTriangle, Plus, Search, X, MoreHorizontal } from 'lucide-react';

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
  const [panelTab, setPanelTab] = useState<'players' | 'tables' | 'eliminated'>('players');
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedSeatPlayerId, setSelectedSeatPlayerId] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

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
  const realtimeChannelRef = useRef<any>(null);
  const lastWarnedMinuteLevelRef = useRef<number>(-1);
  const isFirstLoadRef = useRef(true);

  // Refs for tracking timer states to avoid stale closures in callbacks
  const secondsRemainingRef = useRef(secondsRemaining);
  const isRunningRef = useRef(isRunning);
  const currentLevelIdxRef = useRef(currentLevelIdx);

  useEffect(() => {
    secondsRemainingRef.current = secondsRemaining;
  }, [secondsRemaining]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    currentLevelIdxRef.current = currentLevelIdx;
  }, [currentLevelIdx]);

  // Helper: derive accurate seconds from a DB snapshot with timer_reference_at and client offset
  const deriveSecondsFromSnapshot = (dbSeconds: number, referenceAt: string | null | undefined, isRunning: boolean): number => {
    if (!isRunning) return dbSeconds;
    const resolvedRefAt = referenceAt || new Date(Date.now() + clockOffsetRef.current).toISOString();
    const refTime = new Date(resolvedRefAt).getTime();
    const nowServer = Date.now() + clockOffsetRef.current;
    const elapsed = Math.floor((nowServer - refTime) / 1000);
    return Math.max(0, dbSeconds - elapsed);
  };

  const clockOffsetRef = useRef<number>(0);
  const dbSecondsRemainingRef = useRef<number>(initialTournament.seconds_remaining);
  const dbIsTimerRunningRef = useRef<boolean>(initialTournament.is_timer_running);
  const dbTimerReferenceAtRef = useRef<string | null>(
    initialTournament.is_timer_running && !initialTournament.timer_reference_at
      ? new Date(Date.now() + clockOffsetRef.current).toISOString()
      : (initialTournament.timer_reference_at || null)
  );
  const lastAutoProgressedLevelRef = useRef<number>(-1);
  // FIX niveles pegados: refs para que el intervalo use siempre la versión actual
  const structureRef = useRef<BlindStructure | null>(null);
  const handleLevelUpRef = useRef<() => void>(() => {});
  useEffect(() => {
    structureRef.current = structure;
  }, [structure]);

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
    if (RemainingSeconds === 0) {
      console.log("LOG deriveSeconds details:", {
        seconds_remaining,
        is_timer_running,
        timer_reference_at,
        Offset,
        DateNow: Date.now(),
        resolvedRef,
        getTime: new Date(resolvedRef).getTime(),
        RemainingMs,
        RemainingSeconds
      });
    }
    return RemainingSeconds;
  };

  useEffect(() => {
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
      fetchTournamentData();
    });

    // Initialize Sync channel (local tabs)
    broadcastChannelRef.current = new BroadcastChannel('poker_tournament_sync');
    
    // Listen for requests from newly opened TV screens locally
    broadcastChannelRef.current.onmessage = (event) => {
      if (event.data && event.data.type === 'REQUEST_STATE') {
        broadcastState();
      }
    };

    // Supabase Realtime subscription for cross-device sync and broadcast channel
    const channel = supabase
      .channel('timer_sync', {
        config: {
          broadcast: { self: false }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournaments',
          filter: `id=eq.${initialTournament.id}`
        },
        (payload: any) => {
          const newData = payload.new;
          if (!newData) return;
          
          // Update transition refs from incoming changes
          dbSecondsRemainingRef.current = newData.seconds_remaining;
          dbIsTimerRunningRef.current = newData.is_timer_running;
          dbTimerReferenceAtRef.current = newData.is_timer_running && !newData.timer_reference_at
            ? new Date(Date.now() + clockOffsetRef.current).toISOString()
            : (newData.timer_reference_at || null);
          
          // Compensate with calculated clock offset
          const derivedSeconds = deriveSecondsFromSnapshot(
            newData.seconds_remaining,
            dbTimerReferenceAtRef.current,
            newData.is_timer_running
          );
          
          // Update local state from remote changes
          setTournament(prev => ({ ...prev, ...newData, timer_reference_at: dbTimerReferenceAtRef.current }));
          setSecondsRemaining(derivedSeconds);
          setIsRunning(newData.is_timer_running);
          setCurrentLevelIdx(newData.current_level_index);
        }
      )
      .on('broadcast', { event: 'REQUEST_STATE' }, () => {
        // Someone requested state globally, broadcast it
        broadcastState();
      })
      .subscribe();
    
    realtimeChannelRef.current = channel;

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (broadcastChannelRef.current) broadcastChannelRef.current.close();
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, []);

  // Fast interval loop to derive remaining seconds from high-precision offset and transition refs
  useEffect(() => {
    const interval = setInterval(() => {
      const derived = deriveSeconds();
      if (derived === 0) {
        console.log("LOG INTERVAL TICK: derived is 0", {
          isRunning: dbIsTimerRunningRef.current,
          derived,
          lastAutoProgressed: lastAutoProgressedLevelRef.current,
          currentLevelIdx: currentLevelIdxRef.current,
          structure: !!structure,
          clockOffset: clockOffsetRef.current
        });
      }
      setSecondsRemaining(derived);

      // Automatic level progression when remaining time hits 0
      // Solo marca el nivel como avanzado si la estructura ya cargó (si no, reintenta en el próximo tick)
      if (dbIsTimerRunningRef.current && derived === 0 && structureRef.current && lastAutoProgressedLevelRef.current !== currentLevelIdxRef.current) {
        lastAutoProgressedLevelRef.current = currentLevelIdxRef.current;
        handleLevelUpRef.current();
      }

      // Play warning at 60 seconds (only once per level)
      if (dbIsTimerRunningRef.current && derived === 60 && lastWarnedMinuteLevelRef.current !== currentLevelIdxRef.current) {
        speakAnnounce("¡Último minuto de nivel!");
        lastWarnedMinuteLevelRef.current = currentLevelIdxRef.current;
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

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
        const resolvedRef = tData.is_timer_running && !tData.timer_reference_at
          ? new Date(Date.now() + clockOffsetRef.current).toISOString()
          : (tData.timer_reference_at || null);
        
        setTournament({ ...tData, timer_reference_at: resolvedRef });
        if (isFirstLoadRef.current) {
          // Initialize transition refs
          dbSecondsRemainingRef.current = tData.seconds_remaining;
          dbIsTimerRunningRef.current = tData.is_timer_running;
          dbTimerReferenceAtRef.current = resolvedRef;

          // Use derived seconds to compensate for time elapsed since last DB save
          const derivedSec = deriveSecondsFromSnapshot(
            tData.seconds_remaining,
            resolvedRef,
            tData.is_timer_running
          );
          setSecondsRemaining(derivedSec);
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
      console.log("LOG: fetchTournamentData successfully completed!");
    } catch (err) {
      console.log("LOG: fetchTournamentData failed with error:", err);
      console.error(err);
    } finally {
      setLoading(false);
      // Initial broadcast
      setTimeout(() => broadcastState(), 500);
    }
  };



  const broadcastState = () => {
    const activeLevel = getCurrentLevel();
    const nextLevel = getNextLevel();
    const activeCount = players.filter(p => p.status === 'active').length;

    const { prizePool, payouts } = calculateFinancials();

    const statePayload = {
      tournament_name: tournament.name,
      status: tournament.status,
      seconds_remaining: dbSecondsRemainingRef.current,
      is_timer_running: dbIsTimerRunningRef.current,
      timer_reference_at: dbTimerReferenceAtRef.current,
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
      level_label: activeLevel?.is_break ? 'DESCANSO' : `NIVEL ${activeLevel?.level || 1}`,
      tournament_id: tournament.id
    };

    // 1. Local tabs sync
    broadcastChannelRef.current?.postMessage({
      type: 'STATE_UPDATE',
      payload: statePayload
    });

    // 2. Global cross-device sync via WebSockets
    realtimeChannelRef.current?.send({
      type: 'broadcast',
      event: 'STATE_UPDATE',
      payload: statePayload
    });
  };

  // Sync Broadcast state whenever relevant values change (exclude secondsRemaining to avoid per-second traffic)
  useEffect(() => {
    if (!loading) {
      broadcastState();
    }
  }, [isRunning, currentLevelIdx, players, tournament]);

  const saveTimerStateToDb = async (overrides: Partial<Tournament> = {}) => {
    try {
      const nowServer = new Date(Date.now() + clockOffsetRef.current).toISOString();
      const payload = {
        seconds_remaining: overrides.seconds_remaining ?? dbSecondsRemainingRef.current,
        is_timer_running: overrides.is_timer_running ?? dbIsTimerRunningRef.current,
        current_level_index: overrides.current_level_index ?? currentLevelIdxRef.current,
        timer_reference_at: overrides.timer_reference_at ?? nowServer,
        ...overrides
      };

      await supabase
        .from('tournaments')
        .update(payload)
        .eq('id', tournament.id);

      // On transitions, writes the state (including timer_reference_at fetched from get_server_time RPC or calculated high-precision server time) to DB,
      // and broadcasts the state change over channel `timer_sync`, event `STATE_CHANGE`.
      realtimeChannelRef.current?.send({
        type: 'broadcast',
        event: 'STATE_CHANGE',
        payload: {
          seconds_remaining: payload.seconds_remaining,
          is_timer_running: payload.is_timer_running,
          current_level_index: payload.current_level_index,
          timer_reference_at: payload.timer_reference_at,
          tournament_id: tournament.id
        }
      });
    } catch (e) {
      console.error('Error saving timer state:', e);
    }
  };

  const handlePlayPause = () => {
    const nextRunning = !isRunning;
    const nowServer = new Date(Date.now() + clockOffsetRef.current).toISOString();
    const currentDerived = secondsRemainingRef.current;

    dbIsTimerRunningRef.current = nextRunning;
    dbTimerReferenceAtRef.current = nowServer;
    dbSecondsRemainingRef.current = currentDerived;

    setIsRunning(nextRunning);
    saveTimerStateToDb({
      is_timer_running: nextRunning,
      seconds_remaining: currentDerived,
      timer_reference_at: nowServer
    });
    
    // Log action
    addLog('timer_action', { message: nextRunning ? 'Reloj reanudado' : 'Reloj pausado' });
  };

  const handleLevelUp = () => {
    console.log("LOG: handleLevelUp entered", {
      structure: !!structure,
      currentLevelIdx: currentLevelIdxRef.current
    });
    if (!structure) return;
    const lvls = getLevelsArray();
    const nextIdx = currentLevelIdxRef.current + 1;
    const nowServer = new Date(Date.now() + clockOffsetRef.current).toISOString();

    if (nextIdx < lvls.length) {
      const nextLevel = lvls[nextIdx];

      dbIsTimerRunningRef.current = isRunningRef.current;
      dbTimerReferenceAtRef.current = nowServer;
      dbSecondsRemainingRef.current = nextLevel.duration * 60;

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
        seconds_remaining: nextLevel.duration * 60,
        timer_reference_at: nowServer
      });
    } else {
      dbIsTimerRunningRef.current = false;
      dbTimerReferenceAtRef.current = nowServer;
      dbSecondsRemainingRef.current = 0;

      setIsRunning(false);
      setSecondsRemaining(0);

      saveTimerStateToDb({
        is_timer_running: false,
        seconds_remaining: 0,
        timer_reference_at: nowServer
      });
      alert('¡Has completado todos los niveles de ciegas!');
    }
  };

  // Mantener el ref apuntando a la versión actual de handleLevelUp en cada render
  handleLevelUpRef.current = handleLevelUp;

  const handleLevelDown = () => {
    if (!structure || currentLevelIdxRef.current === 0) return;
    const lvls = getLevelsArray();
    const prevIdx = currentLevelIdxRef.current - 1;
    const prevLevel = lvls[prevIdx];
    const nowServer = new Date(Date.now() + clockOffsetRef.current).toISOString();

    dbIsTimerRunningRef.current = isRunningRef.current;
    dbTimerReferenceAtRef.current = nowServer;
    dbSecondsRemainingRef.current = prevLevel.duration * 60;

    setCurrentLevelIdx(prevIdx);
    setSecondsRemaining(prevLevel.duration * 60);
    
    if (prevLevel.is_break) {
      addLog('level_change', { level: 0, small_blind: 0, big_blind: 0, is_break: true, direction: 'back' });
    } else {
      addLog('level_change', { level: prevLevel.level, small_blind: prevLevel.small_blind, big_blind: prevLevel.big_blind, direction: 'back' });
    }

    saveTimerStateToDb({
      current_level_index: prevIdx,
      seconds_remaining: prevLevel.duration * 60,
      timer_reference_at: nowServer
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
    window.open(`?tv=true&id=${tournament.id}`, '_blank', 'width=1000,height=700,menubar=no,toolbar=no,location=no');
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
    const s = structure;
    if (!s) return [];
    if (Array.isArray(s.levels)) return s.levels;
    return (s.levels as any).levels || [];
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

  // --- Datos derivados para la vista rediseñada ---
  const levelsArr = getLevelsArray();
  const levelsCount = Math.max(levelsArr.length, 1);
  const levelTotalSecs = (activeLevel?.duration || 0) * 60;
  const levelProgress = levelTotalSecs > 0 ? Math.min(1, Math.max(0, 1 - secondsRemaining / levelTotalSecs)) : 0;
  const nextBreakSeconds = (() => {
    let acc = secondsRemaining;
    for (let i = currentLevelIdx + 1; i < levelsArr.length; i++) {
      if (levelsArr[i].is_break) return acc;
      acc += levelsArr[i].duration * 60;
    }
    return null;
  })();
  const formatLong = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const sec = secs % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}` : formatTime(secs);
  };
  const money = (n: number) => Number(n || 0).toLocaleString('es-CL');
  const initials = (p: TournamentPlayer) => getPlayerName(p).substring(0, 2).toUpperCase();
  const avgStack = calculateAverageStack(activePlayers.length);
  const totalRebuys = players.reduce((acc, p) => acc + (p.rebuys_count || 0), 0);
  const totalAddons = players.filter(p => p.has_add_on).length;
  const searchTerm = playerSearch.trim().toLowerCase();
  const matchesSearch = (p: TournamentPlayer) => !searchTerm || getPlayerName(p).toLowerCase().includes(searchTerm);
  const filteredActive = activePlayers
    .filter(matchesSearch)
    .sort((a, b) => (a.table_number || 0) - (b.table_number || 0) || (a.seat_number || 0) - (b.seat_number || 0));
  const eliminatedPlayers = players.filter(p => p.status === 'eliminated');
  const filteredEliminated = eliminatedPlayers
    .filter(matchesSearch)
    .sort((a, b) => (a.elimination_position || 999) - (b.elimination_position || 999));
  const selectedSeatPlayer = activePlayers.find(p => p.id === selectedSeatPlayerId) || null;
  const logText = (log: TournamentLog): string => {
    const pl = log.payload || {};
    switch (log.event_type) {
      case 'elimination': return `${pl.player_name} eliminado (${pl.position}°)`;
      case 'rebuy': return `${pl.player_name}: recompra #${pl.count}`;
      case 'addon': return `${pl.player_name}: add-on`;
      case 'level_change': return pl.is_break ? 'Comienza descanso' : `Nivel ${pl.level} (${pl.small_blind}/${pl.big_blind})`;
      default: return pl.message || log.event_type;
    }
  };

  const sortedWinners = [...players]
    .filter(p => p.elimination_position !== null)
    .sort((a, b) => (a.elimination_position || 99) - (b.elimination_position || 99));

  if (loading && !structure) {
    return <div style={styles.loadingContainer}>Cargando centro de control del torneo...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: C.text }}>
      {/* Header */}
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button type="button" onClick={onBack} style={ghostBtn}>
            <ArrowLeft size={16} /> Panel
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '12px', color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {tournament.status === 'completed' ? 'Torneo finalizado' : 'En curso'}
            </span>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>{tournament.name}</h2>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', position: 'relative' }}>
          <button type="button" onClick={handleOpenTV} style={secondaryBtn}>
            <Tv size={18} /> Abrir pantalla TV
          </button>
          <button type="button" aria-label="Más opciones del torneo" onClick={() => setShowMoreMenu(v => !v)} style={{ ...ghostBtn, width: '44px', justifyContent: 'center', padding: 0 }}>
            <MoreHorizontal size={18} />
          </button>
          {showMoreMenu && (
            <div style={{ position: 'absolute', right: 0, top: '52px', zIndex: 20, background: C.panel, border: `1px solid ${C.borderStrong}`, borderRadius: '12px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px', boxShadow: '0 12px 30px rgba(0,0,0,0.4)' }}>
              {tournament.status !== 'completed' && (
                <button type="button" style={menuItemBtn} onClick={() => { setShowMoreMenu(false); handleManualCompleteTournament(); }}>
                  Finalizar torneo
                </button>
              )}
              <button type="button" style={{ ...menuItemBtn, color: C.danger }} onClick={() => { setShowMoreMenu(false); handleDeleteTournament(); }}>
                Eliminar torneo
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Reloj protagonista */}
      <section aria-label="Reloj del torneo" style={{ background: '#0E1626', border: `1px solid ${isRunning ? '#1F6B52' : C.border}`, borderRadius: '20px', padding: '28px 32px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {tournament.status === 'completed' ? (
          <div style={styles.completedHeaderCard}>
            <div style={styles.completedBadge}><Award size={20} color="#f59e0b" /> TORNEO CONCLUIDO</div>
            <div style={styles.podiumContainer}>
              {sortedWinners[1] && (
                <div style={styles.podiumStep2}>
                  <div style={styles.podiumAvatar}>🥈</div>
                  <div style={styles.podiumName}>{getPlayerName(sortedWinners[1])}</div>
                  <div style={styles.podiumPrize}>${money(sortedWinners[1].payout_amount || payouts[1] || 0)}</div>
                  <div style={styles.podiumLabel}>2° Puesto</div>
                </div>
              )}
              {sortedWinners[0] && (
                <div style={styles.podiumStep1}>
                  <div style={styles.podiumAvatarMain}>🏆</div>
                  <div style={styles.podiumNameMain}>{getPlayerName(sortedWinners[0])}</div>
                  <div style={styles.podiumPrizeMain}>${money(sortedWinners[0].payout_amount || payouts[0] || 0)}</div>
                  <div style={styles.podiumLabelMain}>GANADOR</div>
                </div>
              )}
              {sortedWinners[2] && (
                <div style={styles.podiumStep3}>
                  <div style={styles.podiumAvatar}>🥉</div>
                  <div style={styles.podiumName}>{getPlayerName(sortedWinners[2])}</div>
                  <div style={styles.podiumPrize}>${money(sortedWinners[2].payout_amount || payouts[2] || 0)}</div>
                  <div style={styles.podiumLabel}>3° Puesto</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: isRunning ? '#6EE7B7' : C.muted }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '5px', background: isRunning ? C.green : C.muted }}></span>
                {isRunning ? 'En juego' : 'En pausa'} · Etapa {currentLevelIdx + 1} de {levelsCount}
              </span>
              {nextBreakSeconds !== null && !activeLevel?.is_break && (
                <span style={{ fontSize: '15px', color: C.soft }}>Próximo descanso <strong style={{ color: C.text }}>en {formatLong(nextBreakSeconds)}</strong></span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 200px', minWidth: 0 }}>
                <span style={labelCaps}>{activeLevel?.is_break ? 'Descanso' : 'Ciegas'}</span>
                <span style={{ fontSize: 'clamp(30px, 3.4vw, 54px)', fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap', color: activeLevel?.is_break ? C.green : C.gold }}>
                  {activeLevel?.is_break ? 'BREAK' : `${money(activeLevel?.small_blind || 0)} / ${money(activeLevel?.big_blind || 0)}`}
                </span>
                {!activeLevel?.is_break && <span style={{ fontSize: '16px', color: C.soft }}>Ante {money(activeLevel?.ante || 0)}</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', flex: '2 1 320px', minWidth: 0 }}>
                <span style={{ fontSize: 'clamp(32px, 3.6vw, 52px)', fontWeight: 800, lineHeight: 1, letterSpacing: '0.1em', textTransform: 'uppercase', color: activeLevel?.is_break ? C.green : C.text, background: activeLevel?.is_break ? 'rgba(52, 211, 153, 0.12)' : C.raised, border: `1px solid ${activeLevel?.is_break ? '#1F6B52' : C.borderStrong}`, borderRadius: '14px', padding: '10px 28px' }}>
                  {activeLevel?.is_break ? 'Descanso' : `Nivel ${activeLevel?.level || 1}`}
                </span>
                <span className="control-timer-display" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'clamp(88px, 11vw, 168px)', fontWeight: 700, lineHeight: 0.9, letterSpacing: '-0.04em', color: secondsRemaining <= 60 && isRunning ? '#FCA5A5' : C.text }}>
                  {formatTime(secondsRemaining)}
                </span>
                <div role="img" aria-label={`Progreso del nivel: ${Math.round(levelProgress * 100)} por ciento`} style={{ width: '100%', maxWidth: '520px', height: '10px', borderRadius: '5px', background: C.border, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(levelProgress * 100)}%`, height: '10px', background: C.green, borderRadius: '5px', transition: 'width 0.3s linear' }}></div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', textAlign: 'right', flex: '1 1 200px', minWidth: 0 }}>
                <span style={labelCaps}>Siguiente nivel</span>
                {nextLevel ? (
                  nextLevel.is_break ? (
                    <span style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 700, lineHeight: 1, color: C.green }}>Descanso · {nextLevel.duration} min</span>
                  ) : (
                    <>
                      <span style={{ fontSize: 'clamp(24px, 2.6vw, 40px)', fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>{money(nextLevel.small_blind)} / {money(nextLevel.big_blind)}</span>
                      <span style={{ fontSize: '16px', color: C.soft }}>Ante {money(nextLevel.ante || 0)}</span>
                    </>
                  )
                ) : (
                  <span style={{ fontSize: '20px', color: C.soft }}>Último nivel</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
              <button type="button" aria-label="Nivel anterior" title="Nivel Anterior" onClick={handleLevelDown} style={roundBtn(60)}>
                <Rewind size={22} />
              </button>
              <button type="button" aria-label={isRunning ? 'Pausar reloj' : 'Iniciar reloj'} title={isRunning ? 'Pausar' : 'Iniciar'} onClick={handlePlayPause}
                style={{ ...roundBtn(88), background: isRunning ? C.amber : C.green, border: 0, color: '#111827' }}>
                {isRunning ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" />}
              </button>
              <button type="button" aria-label="Siguiente nivel" title="Siguiente Nivel" onClick={handleLevelUp} style={roundBtn(60)}>
                <FastForward size={22} />
              </button>
            </div>
          </>
        )}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
        {/* Panel principal: jugadores / mesas / eliminados */}
        <section aria-label="Jugadores" style={{ ...panel, flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div role="tablist" aria-label="Vistas" style={{ display: 'flex', gap: '4px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '4px' }}>
              {([
                ['players', `Jugadores · ${activePlayers.length}`],
                ['tables', `Mesas · ${activeTableNumbers.length}`],
                ['eliminated', `Eliminados · ${eliminatedPlayers.length}`],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={panelTab === key} onClick={() => setPanelTab(key)}
                  style={{ minHeight: '40px', padding: '0 16px', borderRadius: '9px', border: 0, cursor: 'pointer', fontSize: '14px', fontWeight: panelTab === key ? 600 : 500, background: panelTab === key ? C.raised : 'transparent', color: panelTab === key ? C.text : C.soft }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: '1 1 280px', justifyContent: 'flex-end' }}>
              {panelTab !== 'tables' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', background: C.bg, border: `1px solid ${C.borderStrong}`, borderRadius: '10px', padding: '0 12px', minHeight: '44px', flex: '1 1 200px', maxWidth: '320px', color: C.muted }}>
                  <Search size={16} />
                  <input type="search" aria-label="Buscar jugador" placeholder="Buscar jugador…" value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: C.text, fontSize: '14px' }} />
                </label>
              )}
              {panelTab === 'tables' && tournament.status !== 'completed' && activeTableNumbers.length > 1 && (
                <button type="button" style={secondaryBtn} onClick={handleAutoBalance}>
                  <Shuffle size={16} /> Balancear mesas
                </button>
              )}
              {tournament.status !== 'completed' && (
                <button type="button" onClick={openLateRegistrationModal} style={{ ...secondaryBtn, background: C.greenDark, color: '#062B1F', border: 0, fontWeight: 700 }}>
                  <Plus size={16} /> Registro tardío
                </button>
              )}
            </div>
          </div>

          {panelTab === 'players' && (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: '640px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ ...rowGrid, padding: '0 12px 10px', borderBottom: `1px solid ${C.border}` }}>
                  <span style={labelCaps}>Jugador</span><span style={labelCaps}>Mesa · Silla</span><span style={labelCaps}>Recompras</span><span style={labelCaps}>Add-on</span><span style={{ ...labelCaps, textAlign: 'right' }}>Acciones</span>
                </div>
                {filteredActive.map((p) => (
                  <div key={p.id} style={{ ...rowGrid, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #172036' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <span style={avatar(false)}>{initials(p)}</span>
                      <span style={{ fontSize: '16px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getPlayerName(p)}</span>
                    </span>
                    <span style={{ fontSize: '14px', color: C.soft }}>M{p.table_number ?? '-'} · S{p.seat_number ?? '-'}</span>
                    <span style={{ fontSize: '15px', fontWeight: 600 }}>{p.rebuys_count}</span>
                    <span style={{ fontSize: '14px', color: p.has_add_on ? C.green : C.muted, fontWeight: p.has_add_on ? 700 : 400 }}>{p.has_add_on ? 'Sí' : 'No'}</span>
                    <span style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      {tournament.status !== 'completed' && (
                        <>
                          <button type="button" style={smallBtn} title="Registrar Recompra" onClick={() => handleAddPlayerAction(p, 'rebuy')}>+ Recompra</button>
                          {!p.has_add_on && (
                            <button type="button" style={smallBtn} title="Registrar Add-On" onClick={() => handleAddPlayerAction(p, 'addon')}>+ Add-on</button>
                          )}
                          <button type="button" aria-label={`Eliminar a ${getPlayerName(p)}`} title="Eliminar" onClick={() => handleAddPlayerAction(p, 'eliminate')}
                            style={{ width: '40px', height: '40px', background: 'transparent', color: '#FCA5A5', border: '1px solid #4A2530', borderRadius: '9px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <X size={16} />
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                ))}
                {filteredActive.length === 0 && (
                  <div style={{ padding: '24px 12px', color: C.muted, fontSize: '14px' }}>
                    {playerSearch ? 'Ningún jugador activo coincide con la búsqueda.' : 'No hay jugadores activos.'}
                  </div>
                )}
              </div>
            </div>
          )}

          {panelTab === 'eliminated' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredEliminated.map((p) => (
                <div key={p.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #172036' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ minWidth: '44px', fontSize: '18px', fontWeight: 700, color: C.gold }}>{p.elimination_position ? `${p.elimination_position}°` : '-'}</span>
                    <span style={{ fontSize: '16px', fontWeight: 600 }}>{getPlayerName(p)}</span>
                    <span style={{ fontSize: '13px', color: C.muted }}>{p.rebuys_count} recompras{p.has_add_on ? ' · add-on' : ''}</span>
                  </span>
                  {tournament.status !== 'completed' && (
                    <button type="button" style={smallBtn} onClick={() => handleRestorePlayer(p)} title="Restituir jugador al torneo">
                      <RotateCcw size={14} /> Restituir
                    </button>
                  )}
                </div>
              ))}
              {filteredEliminated.length === 0 && (
                <div style={{ padding: '24px 12px', color: C.muted, fontSize: '14px' }}>Todavía no hay eliminados.</div>
              )}
            </div>
          )}

          {panelTab === 'tables' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {activeTableNumbers.map((tableNum) => {
                const playersAtTable = activePlayers.filter(p => p.table_number === tableNum);
                const seatsCount = tournament.max_players_per_table;
                return (
                  <div key={tableNum} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Mesa {tableNum}</h3>
                      <span style={{ fontSize: '14px', color: C.soft }}>{playersAtTable.length} de {seatsCount} sillas ocupadas</span>
                    </div>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '760px', aspectRatio: '760 / 430', margin: '0 auto' }}>
                      <div style={{ position: 'absolute', left: '14%', right: '14%', top: '22%', bottom: '22%', borderRadius: '999px', background: '#0F3B2E', border: '10px solid #1C2638', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px', textAlign: 'center', padding: '0 12px' }}>
                        <span style={{ fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8FD9BC' }}>Mesa {tableNum}</span>
                        <span style={{ fontSize: '13px', color: '#8FD9BC' }}>Toca una silla para ver acciones</span>
                      </div>
                      {Array.from({ length: seatsCount }).map((_, seatIdx) => {
                        const seatNum = seatIdx + 1;
                        const player = playersAtTable.find(p => p.seat_number === seatNum);
                        const angle = (seatIdx * (360 / seatsCount) - 90) * (Math.PI / 180);
                        const left = 50 + 43 * Math.cos(angle);
                        const top = 50 + 40 * Math.sin(angle);
                        const isSel = !!player && player.id === selectedSeatPlayerId;
                        return (
                          <div key={seatNum} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)', width: '96px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                            {player ? (
                              <>
                                <button type="button" aria-label={`Silla ${seatNum}: ${getPlayerName(player)}`} title={`Silla ${seatNum}: ${getPlayerName(player)}`}
                                  onClick={() => setSelectedSeatPlayerId(isSel ? null : player.id)}
                                  style={{ width: '56px', height: '56px', borderRadius: '28px', background: isSel ? C.amber : C.greenDark, color: isSel ? '#111827' : '#062B1F', border: isSel ? '3px solid #FDE68A' : 0, fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>
                                  {initials(player)}
                                </button>
                                <span style={{ fontSize: '14px', fontWeight: 600, background: C.bg, padding: '2px 8px', borderRadius: '6px', maxWidth: '96px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getPlayerName(player)}</span>
                              </>
                            ) : (
                              <>
                                <span aria-label={`Silla ${seatNum} libre`} style={{ width: '56px', height: '56px', borderRadius: '28px', border: '2px dashed #3A4660', color: C.muted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, boxSizing: 'border-box' }}>{seatNum}</span>
                                <span style={{ fontSize: '13px', color: C.muted }}>Libre</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {activeTableNumbers.length === 0 && (
                <div style={{ padding: '24px 12px', color: C.muted, fontSize: '14px' }}>No hay mesas activas.</div>
              )}
            </div>
          )}
        </section>

        {/* Panel lateral */}
        <aside style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          {panelTab === 'tables' && selectedSeatPlayer && tournament.status !== 'completed' && (
            <section aria-label="Jugador seleccionado" style={{ ...panel, border: `1px solid ${C.amber}`, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ ...avatar(true), width: '44px', height: '44px', borderRadius: '22px' }}>{initials(selectedSeatPlayer)}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 700 }}>{getPlayerName(selectedSeatPlayer)}</span>
                  <span style={{ fontSize: '13px', color: C.soft }}>
                    Mesa {selectedSeatPlayer.table_number} · Silla {selectedSeatPlayer.seat_number} · {selectedSeatPlayer.rebuys_count} recompras · {selectedSeatPlayer.has_add_on ? 'con add-on' : 'sin add-on'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                <button type="button" style={{ ...smallBtn, minHeight: '48px' }} onClick={() => handleAddPlayerAction(selectedSeatPlayer, 'rebuy')}>+ Recompra</button>
                <button type="button" style={{ ...smallBtn, minHeight: '48px', opacity: selectedSeatPlayer.has_add_on ? 0.5 : 1 }} disabled={selectedSeatPlayer.has_add_on} onClick={() => handleAddPlayerAction(selectedSeatPlayer, 'addon')}>+ Add-on</button>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: C.muted }}>
                  Mesa
                  <select value={selectedSeatPlayer.table_number || ''} onChange={(e) => handleMovePlayerTable(selectedSeatPlayer.id, Number(e.target.value))} style={selectStyle}>
                    {Array.from({ length: Math.max(activeTableNumbers.length ? Math.max(...activeTableNumbers) : 1, Math.ceil(activePlayers.length / tournament.max_players_per_table)) }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>Mesa {i + 1}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: C.muted }}>
                  Silla
                  <select value={selectedSeatPlayer.seat_number || ''} onChange={(e) => handleMovePlayerSeat(selectedSeatPlayer.id, Number(e.target.value))} style={selectStyle}>
                    {Array.from({ length: tournament.max_players_per_table }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>Silla {i + 1}</option>
                    ))}
                  </select>
                </label>
                <button type="button" style={{ ...smallBtn, minHeight: '48px', gridColumn: '1 / -1', background: 'transparent', color: '#FCA5A5', border: '1px solid #4A2530' }}
                  onClick={() => { const p = selectedSeatPlayer; setSelectedSeatPlayerId(null); handleAddPlayerAction(p, 'eliminate'); }}>
                  Eliminar…
                </button>
              </div>
            </section>
          )}

          {balancingAlert && tournament.status !== 'completed' && (
            <section aria-label="Balance de mesas" style={{ ...panel, border: `1px solid ${C.amber}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 600 }}>
                <ShieldAlert size={18} color={C.amber} /> Balance de mesas
              </div>
              <span style={{ fontSize: '14px', color: C.soft }}>{balancingAlert}</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {balancingAlert.includes('Unir Mesas') && (
                  <button type="button" style={smallBtn} onClick={handleMergeTables}><Shuffle size={14} /> Unir mesas</button>
                )}
                {balancingAlert.includes('Desbalance') && (
                  <button type="button" style={smallBtn} onClick={handleAutoBalance}><Shuffle size={14} /> Balancear</button>
                )}
              </div>
            </section>
          )}

          <section aria-label="Resumen" style={{ ...panel, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
            <div style={statBox}><span style={statLabel}>Jugadores activos</span><span style={statValue}>{activePlayers.length} <span style={{ fontSize: '16px', color: C.muted }}>/ {players.length}</span></span></div>
            <div style={statBox}>
              <span style={statLabel}>Pila promedio</span>
              <span style={statValue}>{money(avgStack)}</span>
              {activeLevel && !activeLevel.is_break && activeLevel.big_blind > 0 && (
                <span style={{ fontSize: '13px', color: C.soft }}>{Math.round(avgStack / activeLevel.big_blind)} ciegas grandes</span>
              )}
            </div>
            <div style={statBox}><span style={statLabel}>Pozo a repartir</span><span style={{ ...statValue, color: C.gold }}>${money(prizePool)}</span></div>
            <div style={statBox}><span style={statLabel}>Recompras · Add-ons</span><span style={statValue}>{totalRebuys} · {totalAddons}</span></div>
            {tournament.rake_amount > 0 && (
              <div style={{ ...statBox, gridColumn: '1 / -1' }}><span style={statLabel}>Rake de la fecha</span><span style={{ fontSize: '18px', fontWeight: 700 }}>${money(rakeTotal)}</span></div>
            )}
          </section>

          <section aria-label="Premios" style={{ ...panel, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: C.soft }}>Premios</h3>
            {payouts.map((amount, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                <span>{idx + 1}° · {tournament.payout_structure[idx]}%</span>
                <strong>${money(amount)}</strong>
              </div>
            ))}
          </section>

          <section aria-label="Historial reciente" style={{ ...panel, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: C.soft }}>Historial</h3>
              <a href="#registro-actividad" style={{ fontSize: '13px', color: '#34D399' }}>Ver todo</a>
            </div>
            {logs.slice(0, 4).map((log) => (
              <div key={log.id} style={{ display: 'flex', gap: '8px', fontSize: '14px', alignItems: 'baseline' }}>
                <span style={{ color: C.muted, flex: 'none' }}>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span style={{ minWidth: 0 }}>{logText(log)}</span>
              </div>
            ))}
            {logs.length === 0 && <span style={{ fontSize: '14px', color: C.muted }}>Sin actividad todavía.</span>}
          </section>
        </aside>
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
      <div id="registro-actividad" className="glass-panel" style={styles.logsSection}>
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

// --- Tokens y estilos de la vista rediseñada ---
const C = {
  bg: '#0A0F1C',
  panel: '#111827',
  raised: '#1A2236',
  border: '#1F2A40',
  borderStrong: '#2A3550',
  text: '#E8ECF4',
  soft: '#A9B2C6',
  muted: '#8A94A8',
  green: '#34D399',
  greenDark: '#10B981',
  gold: '#FCD34D',
  amber: '#F59E0B',
  danger: '#FCA5A5',
};
const panel: React.CSSProperties = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '20px', boxSizing: 'border-box' };
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '8px', color: C.soft, background: 'transparent', fontSize: '14px', fontWeight: 500, padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: '10px', minHeight: '44px', cursor: 'pointer' };
const secondaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '8px', background: C.raised, color: C.text, border: `1px solid ${C.borderStrong}`, borderRadius: '10px', padding: '0 16px', minHeight: '44px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' };
const smallBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minHeight: '40px', padding: '0 12px', background: C.raised, color: C.text, border: `1px solid ${C.borderStrong}`, borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
const menuItemBtn: React.CSSProperties = { textAlign: 'left', background: 'transparent', color: C.text, border: 0, borderRadius: '8px', padding: '10px 12px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' };
const selectStyle: React.CSSProperties = { minHeight: '40px', background: C.bg, color: C.text, border: `1px solid ${C.borderStrong}`, borderRadius: '9px', padding: '0 8px', fontSize: '13px' };
const labelCaps: React.CSSProperties = { fontSize: '12px', color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' };
const rowGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(180px, 2fr) 120px 90px 90px minmax(220px, 1.6fr)', gap: '12px' };
const statBox: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
const statLabel: React.CSSProperties = { fontSize: '13px', color: C.muted };
const statValue: React.CSSProperties = { fontSize: '28px', fontWeight: 700 };
const roundBtn = (size: number): React.CSSProperties => ({ width: `${size}px`, height: `${size}px`, borderRadius: `${size / 2}px`, background: C.raised, border: `1px solid ${C.borderStrong}`, color: C.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' });
const avatar = (selected: boolean): React.CSSProperties => ({ width: '36px', height: '36px', borderRadius: '18px', background: selected ? C.amber : '#1E3A34', color: selected ? '#111827' : '#6EE7B7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flex: 'none' });
