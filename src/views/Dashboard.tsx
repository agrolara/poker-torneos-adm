import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Tournament } from '../types';
import { Play, Trophy, Users, Landmark, Plus, FileText, ChevronRight, UserPlus, Clock, Award, Shield, Key, Trash } from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: string, data?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [stats, setStats] = useState({
    totalTourneys: 0,
    totalPlayers: 0,
    totalPrizePool: 0,
  });
  const [loading, setLoading] = useState(true);

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
};
