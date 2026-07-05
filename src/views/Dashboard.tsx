import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Tournament } from '../types';
import { Play, Trophy, Users, Landmark, Plus, FileText, ChevronRight, UserPlus, Clock, Award } from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: string, data?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [stats, setStats] = useState({
    totalTourneys: 0,
    totalPlayers: 0,
    totalPrizePool: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

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

      // Fetch financial stats (sum of payouts)
      const { data: payoutData, error: payoutError } = await supabase
        .from('tournament_players')
        .select('payout_amount');

      if (payoutError) throw payoutError;
      const totalPaid = payoutData?.reduce((acc: number, p: any) => acc + Number(p.payout_amount || 0), 0) || 0;

      setStats({
        totalTourneys: tourneysData?.length || 0,
        totalPlayers: playersCount || 0,
        totalPrizePool: totalPaid,
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={styles.loadingContainer}>Cargando panel de control...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Metrics Row */}
      <div style={styles.metricsRow}>
        <div className="glass-panel" style={styles.metricCard}>
          <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--color-primary-glow)' }}>
            <Trophy size={24} color="var(--color-primary)" />
          </div>
          <div>
            <div style={styles.metricValue}>{stats.totalTourneys}</div>
            <div style={styles.metricLabel}>Torneos Organizados</div>
          </div>
        </div>

        <div className="glass-panel" style={styles.metricCard}>
          <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--color-accent-glow)' }}>
            <Users size={24} color="var(--color-accent)" />
          </div>
          <div>
            <div style={styles.metricValue}>{stats.totalPlayers}</div>
            <div style={styles.metricLabel}>Jugadores en Directorio</div>
          </div>
        </div>

        <div className="glass-panel" style={styles.metricCard}>
          <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--color-secondary-glow)' }}>
            <Landmark size={24} color="var(--color-secondary)" />
          </div>
          <div>
            <div style={styles.metricValue}>${stats.totalPrizePool.toLocaleString()}</div>
            <div style={styles.metricLabel}>Premios Distribuidos</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Tournaments Left, Quick Actions Right */}
      <div style={styles.contentGrid}>
        {/* Tournaments List */}
        <div className="glass-panel" style={styles.listSection}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Historial y Torneos Activos</h2>
            <button className="btn btn-primary" onClick={() => onNavigate('setup')}>
              <Plus size={16} /> Nuevo Torneo
            </button>
          </div>

          {tournaments.length === 0 ? (
            <div style={styles.emptyState}>
              <Award size={48} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
              <p style={{ color: 'var(--color-text-secondary)' }}>No tienes torneos registrados.</p>
              <button 
                className="btn btn-outline" 
                style={{ marginTop: '16px' }}
                onClick={() => onNavigate('setup')}
              >
                Crear mi primer torneo
              </button>
            </div>
          ) : (
            <div style={styles.tourneysList}>
              {tournaments.map((t) => (
                <div key={t.id} style={styles.tourneyRow}>
                  <div style={styles.tourneyInfo}>
                    <div style={styles.tourneyHeader}>
                      <span style={styles.tourneyName}>{t.name}</span>
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
                      <span>Mesas: Max {t.max_players_per_table} jugadores/mesa</span>
                      <span style={styles.dot}>•</span>
                      <span>Fecha: {new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div style={styles.actionGroup}>
                    {t.status === 'completed' ? (
                      <button 
                        className="btn btn-outline"
                        style={styles.actionBtn}
                        onClick={() => onNavigate('control', t)}
                      >
                        Ver Resultados <FileText size={16} />
                      </button>
                    ) : (
                      <button 
                        className="btn btn-accent"
                        style={styles.actionBtn}
                        onClick={() => onNavigate('control', t)}
                      >
                        Controlar Reloj <Play size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div style={styles.sideColumn}>
          <div className="glass-panel" style={styles.sideCard}>
            <h3 style={styles.sideCardTitle}>Administración</h3>
            <p style={styles.sideCardDesc}>Configura la base de jugadores locales y estructuras de tiempo preestablecidas.</p>
            
            <div style={styles.sideLinks}>
              <div 
                style={styles.sideLinkItem} 
                onClick={() => onNavigate('players')}
                className="glass-panel-hover"
              >
                <div style={{ ...styles.smallIconWrapper, backgroundColor: 'var(--color-accent-glow)' }}>
                  <UserPlus size={16} color="var(--color-accent)" />
                </div>
                <div style={styles.linkText}>
                  <div style={styles.linkLabel}>Directorio de Jugadores</div>
                  <div style={styles.linkSub}>Añadir nombres y ver estadísticas generales</div>
                </div>
                <ChevronRight size={18} color="var(--color-text-muted)" />
              </div>

              <div 
                style={styles.sideLinkItem} 
                onClick={() => onNavigate('structures')}
                className="glass-panel-hover"
              >
                <div style={{ ...styles.smallIconWrapper, backgroundColor: 'var(--color-secondary-glow)' }}>
                  <Clock size={16} color="var(--color-secondary)" />
                </div>
                <div style={styles.linkText}>
                  <div style={styles.linkLabel}>Estructura de Ciegas</div>
                  <div style={styles.linkSub}>Plantillas de tiempo, recompras y antes</div>
                </div>
                <ChevronRight size={18} color="var(--color-text-muted)" />
              </div>
            </div>
          </div>
        </div>
      </div>
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
    gridTemplateColumns: 'repeat(3, 1fr)',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  tourneyInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
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
};
