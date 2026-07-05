import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Player } from '../types';
import { User, Plus, Trash2, Edit2, Search, ArrowLeft, X } from 'lucide-react';

interface PlayersProps {
  onBack: () => void;
}

export const Players: React.FC<PlayersProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      fetchPlayers();
    }
  }, [user]);

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('players')
        .select('*')
        .order('name', { ascending: true });

      if (err) throw err;
      setPlayers(data || []);
    } catch (err) {
      console.error('Error fetching players:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!playerName.trim()) {
      setError('El nombre no puede estar vacío');
      return;
    }

    try {
      if (editingPlayer) {
        // Edit player
        const { error: err } = await supabase
          .from('players')
          .update({ name: playerName })
          .eq('id', editingPlayer.id);

        if (err) throw err;
      } else {
        // Create new player
        const { error: err } = await supabase
          .from('players')
          .insert({
            name: playerName,
            organizer_id: user?.id,
          });

        if (err) throw err;
      }

      setPlayerName('');
      setEditingPlayer(null);
      setShowModal(false);
      fetchPlayers();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el jugador');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este jugador de tu directorio?')) {
      return;
    }

    try {
      const { error: err } = await supabase
        .from('players')
        .delete()
        .eq('id', id);

      if (err) throw err;
      fetchPlayers();
    } catch (err) {
      console.error('Error deleting player:', err);
    }
  };

  const filteredPlayers = players.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button className="btn btn-outline" style={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={16} /> Volver
        </button>
        <h2 style={styles.title}>Directorio de Jugadores</h2>
        <button className="btn btn-primary" onClick={() => {
          setEditingPlayer(null);
          setPlayerName('');
          setShowModal(true);
        }}>
          <Plus size={16} /> Agregar Jugador
        </button>
      </div>

      {/* Search and List */}
      <div className="glass-panel" style={styles.contentCard}>
        <div style={styles.searchBar}>
          <Search size={18} color="var(--color-text-muted)" style={styles.searchIcon} />
          <input
            type="text"
            className="form-input"
            style={styles.searchInput}
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div style={styles.loading}>Cargando directorio...</div>
        ) : filteredPlayers.length === 0 ? (
          <div style={styles.emptyState}>
            <User size={48} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
            <p style={{ color: 'var(--color-text-secondary)' }}>
              {searchTerm ? 'No se encontraron jugadores que coincidan con la búsqueda.' : 'No tienes jugadores registrados.'}
            </p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Nombre</th>
                <th style={styles.th}>Fecha de Registro</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => (
                <tr key={player.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.playerNameCol}>
                      <div style={styles.avatar}>
                        {player.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span>{player.name}</span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    {new Date(player.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <div style={styles.actions}>
                      <button
                        style={styles.actionBtnEdit}
                        onClick={() => {
                          setEditingPlayer(player);
                          setPlayerName(player.name);
                          setShowModal(true);
                        }}
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        style={styles.actionBtnDelete}
                        onClick={() => handleDelete(player.id)}
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Popup */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div className="glass-panel" style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{editingPlayer ? 'Editar Jugador' : 'Agregar Nuevo Jugador'}</h3>
              <button style={styles.closeBtn} onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              {error && <div style={styles.errorAlert}>{error}</div>}

              <div className="form-group">
                <label className="form-label">Nombre Completo / Apodo</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej. Juan Pérez"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={styles.modalActions}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPlayer ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>
            </form>
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
    gap: '24px',
    padding: '20px 0',
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
  contentCard: {
    padding: '30px',
  },
  searchBar: {
    position: 'relative',
    marginBottom: '24px',
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  searchInput: {
    paddingLeft: '48px',
  },
  loading: {
    padding: '40px 0',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
  },
  emptyState: {
    padding: '60px 0',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  tableHeaderRow: {
    borderBottom: '1px solid var(--border-color)',
  },
  th: {
    padding: '12px 16px',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tr: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
    transition: 'background-color 0.2s ease',
  },
  td: {
    padding: '16px',
    fontSize: '0.95rem',
    verticalAlign: 'middle',
  },
  playerNameCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: 700,
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
  },
  actions: {
    display: 'inline-flex',
    gap: '8px',
  },
  actionBtnEdit: {
    background: 'rgba(99, 102, 241, 0.1)',
    border: 'none',
    color: 'var(--color-accent)',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  actionBtnDelete: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: 'none',
    color: 'var(--color-danger)',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modalCard: {
    width: '100%',
    maxWidth: '450px',
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  errorAlert: {
    padding: '12px 16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '10px',
  },
};
