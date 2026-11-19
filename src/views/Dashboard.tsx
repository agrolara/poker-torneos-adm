import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Tournament } from '../types';
import { Play, Plus, ChevronRight, Shield, Key, Trash } from 'lucide-react';
import { C, getTheme, themeVars, loadPrefs } from './controlThemes';

interface DashboardProps {
  onNavigate: (view: string, data?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [allTournamentPlayers, setAllTournamentPlayers] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalTourneys: 0,
    totalPlayers: 0,
    totalPrizePool: 0,
    totalRake: 0,
    avgRebuys: '0.0'
  });
  const [loading, setLoading] = useState(true);
  const [dashboardTab, setDashboardTab] = useState<'championship' | 'standalone'>('championship');
  const [showAllHistory, setShowAllHistory] = useState(false);
  // Mismo tema que se eligió en Apariencia (se guarda en el dispositivo)
  const theme = getTheme(loadPrefs().theme);
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = theme.tokens.bg;
    return () => { document.body.style.backgroundColor = prev; };
  }, [theme.tokens.bg]);

  // Active Championship Leaderboard States
  const [activeChampionship, setActiveChampionship] = useState<any | null>(null);
  const [champTournaments, setChampTournaments] = useState<any[]>([]);
  const [champPlayers, setChampPlayers] = useState<any[]>([]);

  const championshipTournaments = tournaments.filter(t => t.championship_id !== null);
  const standaloneTournaments = tournaments.filter(t => t.championship_id === null);
  const activeTournamentsList = dashboardTab === 'championship' ? championshipTournaments : standaloneTournaments;

  // Super Admin state
  const [leagueCodes, setLeagueCodes] = useState<any[]>([]);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  useEffect(() => {
    if (user && (profile?.is_super_admin || user.email === 'materiales.integrity@gmail.com')) {
      fetchLeagueCodes();
    }
  }, [user, profile]);

  const fetchLeagueCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('league_codes')
        .select(`
          code,
          client_name,
          created_at,
          used_by,
          profiles:used_by ( name )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeagueCodes(data || []);
    } catch (err) {
      console.error('Error fetching league codes:', err);
    }
  };

  const handleGenerateCode = async () => {
    const clientName = prompt("Ingresa el nombre del cliente o liga para identificar este código (ej. Club de Póker Lara):");
    if (clientName === null) return; // Cancelled

    setGeneratingCode(true);
    try {
      const code = 'LIGA-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error } = await supabase
        .from('league_codes')
        .insert({
          code,
          client_name: clientName.trim() || 'Sin Nombre',
          created_by: user!.id
        });

      if (error) throw error;
      await fetchLeagueCodes();
    } catch (err) {
      console.error('Error generating league code:', err);
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleDeleteCode = async (codeToDelete: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar el código ${codeToDelete}?`)) return;
    setDeletingCode(codeToDelete);
    try {
      const { error } = await supabase
        .from('league_codes')
        .delete()
        .eq('code', codeToDelete);

      if (error) throw error;
      await fetchLeagueCodes();
    } catch (err) {
      console.error('Error deleting league code:', err);
    } finally {
      setDeletingCode(null);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch tournaments
      const { data: tourneysData, error: tourneysError } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });

      if (tourneysError) throw tourneysError;
      setTournaments(tourneysData || []);

      // Fetch players count
      const { count: playersCount, error: playersError } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true });

      if (playersError) throw playersError;

      // Fetch all tournament players details
      const { data: tpData, error: tpError } = await supabase
        .from('tournament_players')
        .select(`
          tournament_id,
          player_id,
          guest_name,
          status,
          rebuys_count,
          has_add_on,
          elimination_position,
          payout_amount,
          player:player_id ( name )
        `);

      if (tpError) throw tpError;
      setAllTournamentPlayers(tpData || []);

      const totalPaid = tpData?.reduce((acc: number, p: any) => acc + Number(p.payout_amount || 0), 0) || 0;

      // Calculate total rake collected across completed tournaments
      const completedTourneys = tourneysData?.filter((t: any) => t.status === 'completed') || [];
      const totalRakePaid = completedTourneys.reduce((acc: number, t: any) => {
        const tPlayersCount = (tpData || []).filter((cp: any) => cp.tournament_id === t.id).length;
        return acc + tPlayersCount * Number(t.rake_amount || 0);
      }, 0) || 0;

      // Calculate average rebuys per player in completed tournaments
      const completedPlayers = (tpData || []).filter((cp: any) => completedTourneys.some((t: any) => t.id === cp.tournament_id));
      const totalRebuys = completedPlayers.reduce((acc: number, cp: any) => acc + (cp.rebuys_count || 0), 0);
      const avgRebuysVal = completedPlayers.length > 0 ? (totalRebuys / completedPlayers.length).toFixed(1) : '0.0';

      setStats({
        totalTourneys: tourneysData?.length || 0,
        totalPlayers: playersCount || 0,
        totalPrizePool: totalPaid,
        totalRake: totalRakePaid,
        avgRebuys: avgRebuysVal
      });

      // Fetch active championship rankings
      const { data: activeChampData } = await supabase
        .from('championships')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveChampionship(activeChampData || null);

      if (activeChampData) {
        // Fetch tournaments of this championship
        const { data: champTourneys } = await supabase
          .from('tournaments')
          .select('*')
          .eq('championship_id', activeChampData.id);
        
        const completedIds = (champTourneys || [])
          .filter(t => t.status === 'completed')
          .map(t => t.id);

        if (completedIds.length > 0) {
          // Fetch players in these tournaments
          const { data: playersData } = await supabase
            .from('tournament_players')
            .select(`
              tournament_id,
              player_id,
              guest_name,
              rebuys_count,
              has_add_on,
              elimination_position,
              payout_amount,
              player:player_id ( name )
            `)
            .in('tournament_id', completedIds);

          setChampPlayers(playersData || [] as any);
          setChampTournaments(champTourneys || []);
        } else {
          setChampPlayers([]);
          setChampTournaments(champTourneys || []);
        }
      } else {
        setChampPlayers([]);
        setChampTournaments([]);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStandingsForTournaments = (tourneysList: any[]) => {
    const standings: Record<string, {
      key: string;
      name: string;
      points: number;
      played: number;
      wins: number;
    }> = {};

    tourneysList.forEach(t => {
      const playersInTourney = champPlayers.filter(tp => tp.tournament_id === t.id);
      const N = playersInTourney.length;

      playersInTourney.forEach(tp => {
        const key = tp.player_id || `guest-${tp.guest_name}`;
        const name = tp.player?.name || tp.guest_name || 'Invitado';

        if (!standings[key]) {
          standings[key] = {
            key,
            name,
            points: 0,
            played: 0,
            wins: 0
          };
        }

        const entry = standings[key];
        entry.played += 1;

        let pts = 0;
        const rank = tp.elimination_position;
        if (rank) {
          pts += (N - rank + 1) * 10;
          if (rank === 1) {
            pts += 50;
            entry.wins += 1;
          } else if (rank === 2) {
            pts += 30;
          } else if (rank === 3) {
            pts += 20;
          }
        }
        pts += (tp.rebuys_count || 0) * 2;
        if (tp.has_add_on) pts += 3;

        entry.points += pts;
      });
    });

    return Object.values(standings).sort((a, b) => b.points - a.points);
  };

  const calculateDashboardLeaderboard = () => {
    const completedTourneys = [...champTournaments]
      .filter(t => t.status === 'completed')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const K = completedTourneys.length;
    const currentStandings = getStandingsForTournaments(completedTourneys);

    if (K <= 1) {
      return currentStandings.map(player => ({
        ...player,
        trend: '●' as const
      })).slice(0, 5);
    }

    const prevStandings = getStandingsForTournaments(completedTourneys.slice(0, K - 1));

    const fullLeaderboard = currentStandings.map((player, currentIdx) => {
      const currentRank = currentIdx + 1;
      const prevIdx = prevStandings.findIndex(p => p.key === player.key);

      let trend: '▲' | '▼' | '●' = '●';
      if (prevIdx === -1) {
        trend = '▲';
      } else {
        const prevRank = prevIdx + 1;
        if (currentRank < prevRank) {
          trend = '▲';
        } else if (currentRank > prevRank) {
          trend = '▼';
        } else {
          trend = '●';
        }
      }

      return {
        ...player,
        trend
      };
    });

    return fullLeaderboard.slice(0, 5);
  };

  if (loading) {
    return <div style={{ ...themeVars(theme), ...styles.loadingContainer }}>Cargando panel…</div>;
  }

  // --- Datos para la vista ---
  const nameOf = (tp: any) => tp.player?.name || tp.guest_name || 'Invitado';
  const playersOf = (id: string) => allTournamentPlayers.filter(tp => tp.tournament_id === id);
  const liveTournaments = tournaments.filter(t => t.status === 'running' || t.status === 'paused');
  const historyList = activeTournamentsList.filter(t => t.status !== 'running' && t.status !== 'paused');
  const visibleHistory = showAllHistory ? historyList : historyList.slice(0, 6);
  const leaderboard = calculateDashboardLeaderboard();
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '');
  const money = (n: number) => '$' + Number(n || 0).toLocaleString('es-CL');
  const potOf = (t: any) => {
    const tps = playersOf(t.id);
    const gross = tps.length * (t.buy_in_amount || 0)
      + tps.reduce((s, tp) => s + (tp.rebuys_count || 0) * (t.rebuy_amount || 0), 0)
      + tps.reduce((s, tp) => s + (tp.has_add_on ? (t.add_on_amount || 0) : 0), 0);
    return gross - tps.length * (t.rake_amount || 0);
  };
  const completedCount = tournaments.filter(t => t.status === 'completed').length;

  return (
    <div style={{ ...themeVars(theme), ...styles.container }}>
      {/* Encabezado de la página */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: C.text }}>{activeChampionship ? activeChampionship.name : 'Tu liga'}</h1>
          <p style={{ margin: '4px 0 0', fontSize: '15px', color: C.soft }}>
            {completedCount} fecha{completedCount === 1 ? '' : 's'} jugada{completedCount === 1 ? '' : 's'} · {stats.totalPlayers} jugadores en el directorio
          </p>
        </div>
        {liveTournaments.length > 0 && (
          <button type="button" onClick={() => onNavigate('setup')} style={d.secondaryBtn}>
            <Plus size={18} /> Nuevo torneo
          </button>
        )}
      </div>

      {/* Ahora: torneo en juego, o invitación a crear uno */}
      {liveTournaments.length > 0 ? liveTournaments.map(t => {
        const tps = playersOf(t.id);
        const active = tps.filter(tp => tp.status !== 'eliminated').length;
        const running = t.status === 'running';
        return (
          <section key={t.id} aria-label="Torneo en juego" style={{ ...d.card, borderColor: C.clockBorderRun, background: C.clockBg, padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: running ? C.runningText : C.amber }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '5px', background: running ? C.green : C.amber }} />
                {running ? 'En juego' : 'En pausa'}
              </span>
              <span style={{ fontSize: '26px', fontWeight: 700, color: C.text, lineHeight: 1.15 }}>{t.name}</span>
              <span style={{ fontSize: '16px', color: C.soft }}>
                Etapa {(t.current_level_index || 0) + 1} · {active} de {tps.length} jugadores en juego · Pozo {money(potOf(t))}
              </span>
            </div>
            <button type="button" onClick={() => onNavigate('control', t)} style={{ ...d.primaryBtn, minHeight: '60px', padding: '0 28px', fontSize: '17px' }}>
              <Play size={20} fill="currentColor" /> Volver al reloj
            </button>
          </section>
        );
      }) : (
        <section aria-label="Sin torneo en juego" style={{ ...d.card, padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>No hay ningún torneo en juego</span>
            <span style={{ fontSize: '15px', color: C.soft }}>
              {activeChampionship ? `La próxima fecha suma puntos para ${activeChampionship.name}.` : 'Crea una partida o arma un campeonato para llevar el ranking.'}
            </span>
          </div>
          <button type="button" onClick={() => onNavigate('setup')} style={{ ...d.primaryBtn, minHeight: '60px', padding: '0 28px', fontSize: '17px' }}>
            <Plus size={20} /> Nuevo torneo
          </button>
        </section>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'stretch' }}>
        {/* Ranking: lo que más miran los jugadores */}
        <section aria-label="Ranking" style={{ ...d.card, flex: '999 1 420px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
            <h2 style={d.h2}>Ranking</h2>
            {activeChampionship && <button type="button" onClick={() => onNavigate('championships')} style={d.linkBtn}>Tabla completa <ChevronRight size={16} /></button>}
          </div>
          {!activeChampionship ? (
            <div style={d.empty}>
              No hay un campeonato activo.
              <button type="button" onClick={() => onNavigate('championships')} style={{ ...d.secondaryBtn, marginTop: '12px' }}>Crear campeonato</button>
            </div>
          ) : leaderboard.length === 0 ? (
            <div style={d.empty}>Todavía no hay fechas terminadas en este campeonato.</div>
          ) : (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
              {leaderboard.map((p, i) => (
                <li key={p.key} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) auto 64px 28px', alignItems: 'center', gap: '12px', padding: '12px 4px', borderTop: i === 0 ? 'none' : `1px solid ${C.rowLine}` }}>
                  <span style={{ fontSize: i === 0 ? '24px' : '18px', fontWeight: 700, color: i === 0 ? C.gold : C.muted, textAlign: 'center' }}>{i + 1}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: i === 0 ? '20px' : '17px', fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ fontSize: '13px', color: C.muted }}>{p.played} fecha{p.played === 1 ? '' : 's'}{p.wins > 0 ? ` · ${p.wins} victoria${p.wins === 1 ? '' : 's'}` : ''}</span>
                  </span>
                  <span />
                  <span style={{ fontSize: i === 0 ? '24px' : '20px', fontWeight: 700, color: i === 0 ? C.gold : C.text, textAlign: 'right' }}>{p.points}</span>
                  <span aria-label={p.trend === '▲' ? 'Sube' : p.trend === '▼' ? 'Baja' : 'Se mantiene'} style={{ fontSize: '14px', textAlign: 'center', color: p.trend === '▲' ? C.green : p.trend === '▼' ? C.danger : C.muted }}>{p.trend === '●' ? '–' : p.trend}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Números de la liga, en una sola tarjeta */}
        <section aria-label="Números de la liga" style={{ ...d.card, flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <h2 style={d.h2}>Números de la liga</h2>
          {[
            ['Premios repartidos', money(stats.totalPrizePool)],
            ['Rake acumulado', money(stats.totalRake)],
            ['Torneos organizados', String(stats.totalTourneys)],
            ['Recompras por jugador', stats.avgRebuys.replace('.', ',')],
          ].map(([label, value], i) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '14px', color: C.muted }}>{label}</span>
              <span style={{ fontSize: i < 2 ? '26px' : '20px', fontWeight: 700, color: i === 0 ? C.gold : C.text }}>{value}</span>
            </div>
          ))}
        </section>
      </div>

      {/* Fechas jugadas: una línea por fecha */}
      <section aria-label="Fechas" style={{ ...d.card, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={d.h2}>Fechas</h2>
          <div role="tablist" aria-label="Tipo de torneo" style={{ display: 'flex', gap: '4px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '4px' }}>
            {([['championship', `Campeonato · ${championshipTournaments.length}`], ['standalone', `Partidas sueltas · ${standaloneTournaments.length}`]] as const).map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={dashboardTab === key} onClick={() => { setDashboardTab(key); setShowAllHistory(false); }}
                style={{ minHeight: '40px', padding: '0 14px', borderRadius: '9px', border: 0, cursor: 'pointer', fontSize: '14px', fontWeight: dashboardTab === key ? 600 : 500, background: dashboardTab === key ? C.raised : 'transparent', color: dashboardTab === key ? C.text : C.soft }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {historyList.length === 0 ? (
          <div style={d.empty}>{dashboardTab === 'championship' ? 'Todavía no hay fechas de campeonato.' : 'Todavía no hay partidas sueltas.'}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visibleHistory.map((t, i) => {
              const tps = playersOf(t.id);
              const winner = tps.find(tp => tp.elimination_position === 1);
              return (
                <button key={t.id} type="button" onClick={() => onNavigate('control', t)}
                  style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1.4fr) minmax(0, 1fr) auto 20px', alignItems: 'center', gap: '14px', padding: '14px 6px', background: 'transparent', border: 0, borderTop: i === 0 ? 'none' : `1px solid ${C.rowLine}`, color: C.text, textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%' }}>
                  <span style={{ fontSize: '14px', color: C.muted }}>{fmtDate(t.created_at)}</span>
                  <span style={{ fontSize: '16px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                  <span style={{ fontSize: '15px', color: C.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.status === 'completed' ? (winner ? `🏆 ${nameOf(winner)}` : 'Sin ganador') : 'Borrador'}
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 600, textAlign: 'right' }}>{t.status === 'completed' ? money(potOf(t)) : ''}</span>
                  <ChevronRight size={18} color={theme.tokens.muted} />
                </button>
              );
            })}
            {historyList.length > 6 && (
              <button type="button" onClick={() => setShowAllHistory(v => !v)} style={{ ...d.linkBtn, alignSelf: 'center', marginTop: '6px' }}>
                {showAllHistory ? 'Ver menos' : `Ver todas (${historyList.length})`}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Super Admin Section */}
      {(profile?.is_super_admin || user?.email === 'materiales.integrity@gmail.com') && (
        <div className="glass-panel" style={styles.adminSection}>
          <div style={styles.adminHeader}>
            <div style={styles.adminTitleWrapper}>
              <Shield size={22} color="#f59e0b" />
              <h2 style={styles.adminTitle}>Panel de Super Administrador</h2>
            </div>
            <button 
              className="btn btn-primary" 
              style={styles.generateBtn}
              onClick={handleGenerateCode}
              disabled={generatingCode}
            >
              <Key size={16} style={{ marginRight: '6px' }} />
              {generatingCode ? 'Generando...' : 'Crear Código de Liga'}
            </button>
          </div>
          
          <p style={styles.adminDesc}>
            Genera códigos de invitación únicos y de un solo uso para tus clientes. Con estos códigos, tus clientes podrán registrar sus cuentas como organizadores.
          </p>

          <div style={styles.codesContainer}>
            {leagueCodes.length === 0 ? (
              <div style={styles.emptyAdminState}>
                No se han generado códigos de liga todavía. Haz clic en "Crear Código de Liga".
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Código</th>
                    <th style={styles.th}>Cliente / Identificador</th>
                    <th style={styles.th}>Creado el</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Registro Interno</th>
                    <th style={styles.th}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {leagueCodes.map((item) => (
                    <tr key={item.code} style={styles.tr}>
                      <td style={styles.tdCode}>{item.code}</td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{item.client_name || 'Sin Nombre'}</td>
                      <td style={styles.td}>{new Date(item.created_at).toLocaleDateString()}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.adminBadge,
                          backgroundColor: item.used_by ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: item.used_by ? '#ef4444' : 'var(--color-primary)',
                          border: item.used_by ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                        }}>
                          {item.used_by ? 'Utilizado' : 'Activo'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {item.used_by ? (
                          <span style={styles.usedByUser}>
                            👤 {item.profiles?.name || 'Organizador Registrado'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>Esperando cliente...</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <button
                          className="btn btn-outline"
                          style={styles.deleteBtn}
                          onClick={() => handleDeleteCode(item.code)}
                          disabled={deletingCode === item.code}
                        >
                          <Trash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
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
  metricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '24px',
  },
  metricCard: {
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  iconWrapper: {
    padding: '16px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: '2rem',
    fontWeight: 800,
    lineHeight: 1.1,
  },
  metricLabel: {
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    fontWeight: 650,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginTop: '4px',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1.8fr 1fr',
    gap: '30px',
  },
  listSection: {
    padding: '30px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '1.4rem',
    fontWeight: 700,
  },
  tabHeader: {
    display: 'flex',
    gap: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    marginBottom: '20px',
  },
  tabLink: {
    background: 'none',
    border: 'none',
    padding: '10px 16px',
    fontSize: '0.9rem',
    fontWeight: 650,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  emptyState: {
    padding: '60px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  tourneysList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  tourneyRow: {
    padding: '18px 24px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    background: 'rgba(255, 255, 255, 0.01)',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    transition: 'all 0.2s ease',
  },
  tourneyInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: '1 1 300px',
  },
  tourneyHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  tourneyName: {
    fontSize: '1.1rem',
    fontWeight: 700,
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '100px',
    fontSize: '0.75rem',
    fontWeight: 750,
  },
  tourneySub: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
  },
  dot: {
    fontSize: '1.1rem',
    lineHeight: 1,
  },
  actionGroup: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  actionBtn: {
    padding: '8px 16px',
    fontSize: '0.85rem',
  },
  sideColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  sideCard: {
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sideCardTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
  },
  sideCardDesc: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
    marginBottom: '8px',
  },
  sideLinks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sideLinkItem: {
    padding: '16px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    cursor: 'pointer',
    background: 'rgba(255, 255, 255, 0.01)',
  },
  smallIconWrapper: {
    padding: '8px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  linkLabel: {
    fontSize: '0.95rem',
    fontWeight: 650,
  },
  linkSub: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
  },
  adminSection: {
    padding: '30px',
    marginTop: '30px',
    border: '1px solid rgba(245, 158, 11, 0.15)',
  },
  adminHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  adminTitleWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  adminTitle: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  generateBtn: {
    background: 'linear-gradient(135deg, #c5a880 0%, #f59e0b 100%)',
    color: '#000000',
    fontWeight: 700,
    border: 'none',
  },
  adminDesc: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary)',
    marginBottom: '24px',
    lineHeight: 1.5,
  },
  codesContainer: {
    overflowX: 'auto',
  },
  emptyAdminState: {
    padding: '30px',
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    border: '1px dashed rgba(255,255,255,0.08)',
    borderRadius: 'var(--radius-md)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  th: {
    padding: '12px 16px',
    color: 'var(--color-text-muted)',
    fontSize: '0.8rem',
    fontWeight: 650,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  tdCode: {
    padding: '16px',
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#f59e0b',
    letterSpacing: '0.05em',
  },
  td: {
    padding: '16px',
    fontSize: '0.9rem',
    color: 'var(--color-text-secondary)',
  },
  adminBadge: {
    padding: '4px 10px',
    borderRadius: '100px',
    fontSize: '0.75rem',
    fontWeight: 700,
    display: 'inline-block',
  },
  usedByUser: {
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  deleteBtn: {
    padding: '6px 10px',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
  },
  completedDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '8px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '8px',
  },
  miniPodium: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    fontSize: '0.875rem',
    fontWeight: 600,
  },
  financialStats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    fontSize: '0.8rem',
    color: 'var(--color-text-secondary)',
  },
  leaderboardTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    marginTop: '12px',
    minWidth: '280px',
  },
  leaderboardTh: {
    padding: '8px 6px',
    color: 'var(--color-text-muted)',
    fontSize: '0.75rem',
    fontWeight: 650,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  leaderboardTr: {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  leaderboardTd: {
    padding: '8px 6px',
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
  },
};

// --- Estilos de la vista nueva (colores desde el tema) ---
const d: Record<string, React.CSSProperties> = {
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: '18px', padding: '22px', boxSizing: 'border-box' },
  h2: { margin: 0, fontSize: '18px', fontWeight: 700, color: C.text },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: C.green, color: C.onAccent, border: 0, borderRadius: '14px', fontWeight: 700, cursor: 'pointer' },
  secondaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '48px', padding: '0 18px', background: C.raised, color: C.text, border: `1px solid ${C.borderStrong}`, borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  linkBtn: { display: 'inline-flex', alignItems: 'center', gap: '4px', minHeight: '40px', background: 'transparent', border: 0, color: C.link, fontSize: '14px', fontWeight: 600, cursor: 'pointer', padding: '0 4px' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '12px 0', fontSize: '15px', color: C.soft },
};
