import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Tournament, Championship, TournamentPlayer } from '../types';
import { Award, Plus, Trash2, ArrowLeft, Trophy, Calendar, ChevronRight, Check } from 'lucide-react';

interface ChampionshipsProps {
  onNavigate: (view: string, data?: any) => void;
}

export const Championships: React.FC<ChampionshipsProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedChampionship, setSelectedChampionship] = useState<Championship | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // Detailed view states
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentPlayers, setTournamentPlayers] = useState<TournamentPlayer[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'tournaments'>('leaderboard');

  useEffect(() => {
    if (user) {
      fetchChampionships();
    }
  }, [user]);

  const fetchChampionships = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('championships')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChampionships(data || []);
    } catch (err) {
      console.error('Error fetching championships:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChampionship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSubmitLoading(true);
      const { error } = await supabase
        .from('championships')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          organizer_id: user?.id,
          status: 'active'
        });

      if (error) throw error;
      setIsCreating(false);
      setName('');
      setDescription('');
      await fetchChampionships();
    } catch (err) {
      console.error('Error creating championship:', err);
      alert('Error al crear el campeonato');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSelectChampionship = async (championship: Championship) => {
    setSelectedChampionship(championship);
    setActiveTab('leaderboard');
    await fetchChampionshipDetails(championship.id);
  };

  const fetchChampionshipDetails = async (championshipId: string) => {
    try {
      setDetailLoading(true);
      
      // 1. Fetch all tournaments for this championship
      const { data: tourneysData, error: tourneysError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('championship_id', championshipId)
        .order('created_at', { ascending: true });

      if (tourneysError) throw tourneysError;
      const tList = tourneysData || [];
      setTournaments(tList);

      if (tList.length > 0) {
        // 2. Fetch all players in these tournaments
        const tIds = tList.map(t => t.id);
        const { data: playersData, error: playersError } = await supabase
          .from('tournament_players')
          .select(`
            id,
            tournament_id,
            player_id,
            guest_name,
            status,
            rebuys_count,
            has_add_on,
            elimination_position,
            payout_amount,
            player:player_id ( name )
          `)
          .in('tournament_id', tIds);

        if (playersError) throw playersError;
        setTournamentPlayers(playersData || [] as any);
      } else {
        setTournamentPlayers([]);
      }
    } catch (err) {
      console.error('Error fetching championship details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteChampionship = async (id: string, name: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el campeonato "${name}"? Se desvincularán todos los torneos asociados.`)) return;

    try {
      const { error } = await supabase
        .from('championships')
        .delete()
        .eq('id', id);

      if (error) throw error;
      if (selectedChampionship?.id === id) {
        setSelectedChampionship(null);
      }
      await fetchChampionships();
    } catch (err) {
      console.error('Error deleting championship:', err);
      alert('Error al eliminar el campeonato');
    }
  };

  const handleFinalizeChampionship = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas finalizar este campeonato? Ya no se podrán agregar nuevas fechas.')) return;

    try {
      const { error } = await supabase
        .from('championships')
        .update({ status: 'completed' })
        .eq('id', id);

      if (error) throw error;
      if (selectedChampionship) {
        setSelectedChampionship({ ...selectedChampionship, status: 'completed' });
      }
      await fetchChampionships();
    } catch (err) {
      console.error('Error finalizing championship:', err);
      alert('Error al finalizar el campeonato');
    }
  };

  // Standings / Leaderboard Calculation
  const calculateLeaderboard = () => {
    const standings: Record<string, {
      name: string;
      points: number;
      played: number;
      wins: number;
      top3: number;
      rebuys: number;
      payouts: number;
    }> = {};

    // Filter completed tournaments
    const completedTourneys = tournaments.filter(t => t.status === 'completed');

    completedTourneys.forEach(t => {
      const playersInTourney = tournamentPlayers.filter(tp => tp.tournament_id === t.id);
      const N = playersInTourney.length;

      playersInTourney.forEach(tp => {
        const key = tp.player_id || `guest-${tp.guest_name}`;
        const name = (tp as any).player?.name || tp.guest_name || 'Invitado';

        if (!standings[key]) {
          standings[key] = {
            name,
            points: 0,
            played: 0,
            wins: 0,
            top3: 0,
            rebuys: 0,
            payouts: 0
          };
        }

        const entry = standings[key];
        entry.played += 1;
        entry.rebuys += tp.rebuys_count || 0;
        entry.payouts += Number(tp.payout_amount || 0);

        // Calculate Points
        let pts = 0;
        const rank = tp.elimination_position;
        if (rank) {
          // Base position points: (N - rank + 1) * 10
          pts += (N - rank + 1) * 10;

          // Podium Bonus
          if (rank === 1) {
            pts += 50;
            entry.wins += 1;
            entry.top3 += 1;
          } else if (rank === 2) {
            pts += 30;
            entry.top3 += 1;
          } else if (rank === 3) {
            pts += 20;
            entry.top3 += 1;
          }
        }

        // Rebuys Bonus: +2 per rebuy
        pts += (tp.rebuys_count || 0) * 2;

        // Add-on Bonus: +3
        if (tp.has_add_on) {
          pts += 3;
        }

        entry.points += pts;
      });
    });

    return Object.values(standings).sort((a, b) => b.points - a.points);
  };

  const leaderboard = calculateLeaderboard();

  return (
    <div style={styles.container}>
      {/* Title & Actions header */}
      <div style={styles.header}>
        {selectedChampionship ? (
          <button className="btn btn-outline" style={styles.backBtn} onClick={() => setSelectedChampionship(null)}>
            <ArrowLeft size={16} /> Volver a Campeonatos
          </button>
        ) : (
          <div />
        )}
        <h2 style={styles.title}>
          {selectedChampionship ? selectedChampionship.name : 'Campeonatos y Rankings'}
        </h2>
        {!selectedChampionship && !isCreating && (
          <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
            <Plus size={16} /> Nuevo Campeonato
          </button>
        )}
        {isCreating && (
          <button className="btn btn-outline" onClick={() => setIsCreating(false)}>
            Cancelar
          </button>
        )}
      </div>

      {/* CREATE FORM */}
      {isCreating && !selectedChampionship && (
        <form onSubmit={handleCreateChampionship} className="glass-panel" style={styles.formCard}>
          <h3 style={styles.subTitle}>Registrar Nuevo Campeonato</h3>
          
          <div className="form-group">
            <label className="form-label">Nombre del Campeonato</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Ej. Torneo de Apertura 2026" 
              value={name} 
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descripción (Opcional)</label>
            <textarea 
              className="form-input" 
              rows={3} 
              placeholder="Ej. Campeonato oficial que consta de 10 fechas puntuables para la clasificación final."
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={submitLoading}>
            {submitLoading ? 'Creando...' : 'Crear Campeonato'}
          </button>
        </form>
      )}

      {/* CHAMPIONSHIP DETAIL SCREEN */}
      {selectedChampionship && (
        <div style={styles.detailContainer}>
          {/* Top Info Bar */}
          <div className="glass-panel" style={styles.infoBar}>
            <div style={styles.infoMeta}>
              <span style={{ 
                ...styles.statusBadge,
                backgroundColor: selectedChampionship.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                color: selectedChampionship.status === 'active' ? 'var(--color-primary)' : 'var(--color-accent)',
                border: selectedChampionship.status === 'active' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)',
              }}>
                {selectedChampionship.status === 'active' ? 'Activo' : 'Completado'}
              </span>
              <span style={styles.infoDesc}>{selectedChampionship.description || 'Sin descripción adicional.'}</span>
            </div>

            <div style={styles.infoActions}>
              {selectedChampionship.status === 'active' && (
                <button className="btn btn-primary" style={styles.actionBtn} onClick={() => handleFinalizeChampionship(selectedChampionship.id)}>
                  <Check size={16} /> Finalizar Campeonato
                </button>
              )}
              <button className="btn btn-outline" style={styles.deleteBtn} onClick={() => handleDeleteChampionship(selectedChampionship.id, selectedChampionship.name)}>
                <Trash2 size={16} /> Eliminar
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={styles.tabsContainer}>
            <button 
              style={{
                ...styles.tabBtn,
                borderBottom: activeTab === 'leaderboard' ? '2px solid #f59e0b' : 'none',
                color: activeTab === 'leaderboard' ? '#ffffff' : 'var(--color-text-muted)',
              }}
              onClick={() => setActiveTab('leaderboard')}
            >
              <Trophy size={16} /> Tabla de Posiciones (Ranking)
            </button>
            <button 
              style={{
                ...styles.tabBtn,
                borderBottom: activeTab === 'tournaments' ? '2px solid #f59e0b' : 'none',
                color: activeTab === 'tournaments' ? '#ffffff' : 'var(--color-text-muted)',
              }}
              onClick={() => setActiveTab('tournaments')}
            >
              <Calendar size={16} /> Historial de Fechas ({tournaments.length})
            </button>
          </div>

          {/* TAB CONTENT: LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="glass-panel" style={styles.tabContentCard}>
              <h3 style={styles.subTitle}>Ranking General</h3>
              {detailLoading ? (
                <div style={styles.loading}>Cargando tabla de clasificación...</div>
              ) : leaderboard.length === 0 ? (
                <div style={styles.emptyState}>
                  No hay fechas completadas registradas en este campeonato aún.
                </div>
              ) : (
                <div style={styles.tableResponsive}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.thRank}>Pos</th>
                        <th style={styles.th}>Jugador</th>
                        <th style={styles.thCenter}>Puntos</th>
                        <th style={styles.thCenter}>Jugados</th>
                        <th style={styles.thCenter}>Victorias</th>
                        <th style={styles.thCenter}>Podios (Top 3)</th>
                        <th style={styles.thCenter}>Recompras</th>
                        <th style={styles.thRight}>Premios ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((player, idx) => (
                        <tr key={idx} style={styles.tr}>
                          <td style={styles.tdRank}>{idx + 1}</td>
                          <td style={{ ...styles.td, fontWeight: 650 }}>{player.name}</td>
                          <td style={{ ...styles.tdCenter, color: 'var(--color-primary)', fontWeight: 700, fontSize: '1.05rem' }}>{player.points}</td>
                          <td style={styles.tdCenter}>{player.played}</td>
                          <td style={styles.tdCenter}>{player.wins}</td>
                          <td style={styles.tdCenter}>{player.top3}</td>
                          <td style={styles.tdCenter}>{player.rebuys}</td>
                          <td style={{ ...styles.tdRight, color: 'var(--color-accent)' }}>${player.payouts.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: TOURNAMENTS (DATES) */}
          {activeTab === 'tournaments' && (
            <div className="glass-panel" style={styles.tabContentCard}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.subTitle}>Fechas Jugadas</h3>
                <button className="btn btn-primary font-small" onClick={() => onNavigate('setup')}>
                  + Programar Fecha
                </button>
              </div>

              {detailLoading ? (
                <div style={styles.loading}>Cargando fechas de torneo...</div>
              ) : tournaments.length === 0 ? (
                <div style={styles.emptyState}>
                  No hay torneos asociados a este campeonato. ¡Crea un torneo y asociálo!
                </div>
              ) : (
                <div style={styles.tourneysList}>
                  {tournaments.map((t, idx) => (
                    <div key={t.id} style={styles.tourneyRow}>
                      <div style={styles.tourneyInfo}>
                        <div style={styles.tourneyHeader}>
                          <span style={styles.tourneyName}>Fecha #{idx + 1}: {t.name}</span>
                          <span style={{ 
                            ...styles.statusBadge, 
                            backgroundColor: 
                              t.status === 'running' ? 'rgba(16, 185, 129, 0.15)' : 
                              t.status === 'paused' ? 'rgba(245, 158, 11, 0.15)' : 
                              t.status === 'completed' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: 
                              t.status === 'running' ? 'var(--color-primary)' : 
                              t.status === 'paused' ? 'var(--color-secondary)' : 
                              t.status === 'completed' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                            border: 
                              t.status === 'running' ? '1px solid rgba(16, 185, 129, 0.3)' : 
                              t.status === 'paused' ? '1px solid rgba(245, 158, 11, 0.3)' : 
                              t.status === 'completed' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                          }}>
                            {t.status === 'draft' ? 'Borrador' :
                             t.status === 'running' ? 'En Vivo' :
                             t.status === 'paused' ? 'Pausado' : 'Completado'}
                          </span>
                        </div>
                        <div style={styles.tourneySub}>
                          <span>Entrada: ${t.buy_in_amount}</span>
                          <span style={styles.dot}>•</span>
                          <span>Fecha: {new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => onNavigate('control', t)}>
                        Administrar Reloj <ChevronRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CHAMPIONSHIPS LIST (ROOT VIEW) */}
      {!selectedChampionship && !isCreating && (
        <div style={styles.listGrid}>
          {loading ? (
            <div style={styles.loading}>Cargando campeonatos...</div>
          ) : championships.length === 0 ? (
            <div className="glass-panel" style={styles.emptyCard}>
              <Award size={48} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
              <h3>No tienes campeonatos creados</h3>
              <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                Crea un campeonato para agrupar múltiples torneos y calcular rankings de puntos acumulativos para tus jugadores.
              </p>
              <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => setIsCreating(true)}>
                Crear mi Primer Campeonato
              </button>
            </div>
          ) : (
            championships.map(c => (
              <div key={c.id} className="glass-panel hover-card" style={styles.champCard} onClick={() => handleSelectChampionship(c)}>
                <div style={styles.champHeader}>
                  <div style={styles.champIconWrapper}>
                    <Trophy size={20} color="var(--color-primary)" />
                  </div>
                  <span style={{ 
                    ...styles.statusBadge,
                    backgroundColor: c.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                    color: c.status === 'active' ? 'var(--color-primary)' : 'var(--color-accent)',
                    border: c.status === 'active' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)',
                    fontSize: '0.75rem',
                  }}>
                    {c.status === 'active' ? 'Activo' : 'Finalizado'}
                  </span>
                </div>

                <h3 style={styles.champTitle}>{c.name}</h3>
                <p style={styles.champDesc}>{c.description || 'Sin descripción.'}</p>
                
                <div style={styles.champFooter}>
                  <span style={styles.champDate}>Creado el {new Date(c.created_at).toLocaleDateString()}</span>
                  <span style={styles.enterLink}>
                    Ver Ranking <ChevronRight size={16} />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    padding: '20px 0',
    fontFamily: 'Outfit, sans-serif',
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
  subTitle: {
    fontSize: '1.2rem',
    fontWeight: 750,
    marginBottom: '16px',
  },
  loading: {
    padding: '40px 0',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    fontSize: '0.9rem',
  },
  formCard: {
    padding: '30px',
    maxWidth: '600px',
    margin: '0 auto',
    width: '100%',
  },
  listGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px',
  },
  emptyCard: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 40px',
    textAlign: 'center',
    maxWidth: '500px',
    margin: '40px auto',
  },
  champCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '200px',
    cursor: 'pointer',
  },
  champHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
  },
  champIconWrapper: {
    width: '38px',
    height: '38px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-primary-glow)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  champTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    marginBottom: '8px',
  },
  champDesc: {
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    lineHeight: '1.4',
    marginBottom: '20px',
    flexGrow: 1,
  },
  champFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    paddingTop: '12px',
  },
  champDate: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
  },
  enterLink: {
    fontSize: '0.85rem',
    color: 'var(--color-primary)',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
  },
  detailContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  infoBar: {
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
  },
  infoMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  infoDesc: {
    fontSize: '0.9rem',
    color: 'var(--color-text-secondary)',
  },
  infoActions: {
    display: 'flex',
    gap: '10px',
  },
  actionBtn: {
    padding: '8px 16px',
    fontSize: '0.85rem',
  },
  deleteBtn: {
    padding: '8px 12px',
    color: '#ef4444',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  tabsContainer: {
    display: 'flex',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    gap: '20px',
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    padding: '12px 16px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  tabContentCard: {
    padding: '30px',
  },
  tableResponsive: {
    width: '100%',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.9rem',
  },
  tr: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    color: 'var(--color-text-muted)',
    fontWeight: 600,
  },
  thRank: {
    textAlign: 'center',
    padding: '12px',
    color: 'var(--color-text-muted)',
    width: '60px',
  },
  thCenter: {
    textAlign: 'center',
    padding: '12px 16px',
    color: 'var(--color-text-muted)',
    fontWeight: 600,
  },
  thRight: {
    textAlign: 'right',
    padding: '12px 16px',
    color: 'var(--color-text-muted)',
    fontWeight: 600,
  },
  td: {
    padding: '14px 16px',
  },
  tdRank: {
    textAlign: 'center',
    padding: '14px 12px',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
  },
  tdCenter: {
    textAlign: 'center',
    padding: '14px 16px',
  },
  tdRight: {
    textAlign: 'right',
    padding: '14px 16px',
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '100px',
    fontWeight: 600,
    fontSize: '0.8rem',
    display: 'inline-block',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  tourneysList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  tourneyRow: {
    padding: '16px 20px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    background: 'rgba(255, 255, 255, 0.01)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tourneyInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  tourneyHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  tourneyName: {
    fontSize: '1rem',
    fontWeight: 650,
  },
  tourneySub: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    display: 'flex',
    gap: '8px',
  },
  dot: {
    color: 'rgba(255,255,255,0.1)',
  }
};
