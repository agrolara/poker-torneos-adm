import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Player, BlindStructure } from '../types';
import { ArrowLeft, Users, Play, Plus, Trash2, Check, Settings, Shield, ChevronRight } from 'lucide-react';

interface TournamentSetupProps {
  onBack: () => void;
  onNavigate: (view: string, data?: any) => void;
}

export const TournamentSetup: React.FC<TournamentSetupProps> = ({ onBack, onNavigate }) => {
  const { user } = useAuth();
  
  // Setup Steps: 1 - Configuration, 2 - Players & Seating
  const [step, setStep] = useState(1);
  
  // Step 1: Config
  const [name, setName] = useState('Torneo de Fin de Semana');
  const [buyInAmount, setBuyInAmount] = useState(10);
  const [buyInChips, setBuyInChips] = useState(10000);
  const [rebuyAmount, setRebuyAmount] = useState(10);
  const [rebuyChips, setRebuyChips] = useState(10000);
  const [addonAmount, setAddonAmount] = useState(10);
  const [addonChips, setAddonChips] = useState(15000);
  
  const [structures, setStructures] = useState<BlindStructure[]>([]);
  const [selectedStructureId, setSelectedStructureId] = useState('');
  const [maxPlayersPerTable, setMaxPlayersPerTable] = useState(8);
  const [payoutOption, setPayoutOption] = useState('1'); // 1: Top 3 (50-30-20), 2: Top 2 (70-30), 3: Winner takes all (100)
  
  // Step 2: Players
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [guestPlayers, setGuestPlayers] = useState<string[]>([]);
  const [newGuestName, setNewGuestName] = useState('');
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSetupData();
    }
  }, [user]);

  const fetchSetupData = async () => {
    try {
      setLoading(true);
      // Fetch blind structures
      const { data: structuresData } = await supabase
        .from('blind_structures')
        .select('*');
      setStructures(structuresData || []);
      if (structuresData && structuresData.length > 0) {
        setSelectedStructureId(structuresData[0].id);
      }

      // Fetch players
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .order('name', { ascending: true });
      setAllPlayers(playersData || []);
    } catch (err) {
      console.error('Error fetching setup data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlayer = (id: string) => {
    if (selectedPlayerIds.includes(id)) {
      setSelectedPlayerIds(selectedPlayerIds.filter(pid => pid !== id));
    } else {
      setSelectedPlayerIds([...selectedPlayerIds, id]);
    }
  };

  const handleAddGuest = () => {
    if (newGuestName.trim()) {
      setGuestPlayers([...guestPlayers, newGuestName.trim()]);
      setNewGuestName('');
    }
  };

  const handleRemoveGuest = (index: number) => {
    setGuestPlayers(guestPlayers.filter((_, i) => i !== index));
  };

  const handleSelectAllPlayers = () => {
    if (selectedPlayerIds.length === allPlayers.length) {
      setSelectedPlayerIds([]);
    } else {
      setSelectedPlayerIds(allPlayers.map(p => p.id));
    }
  };

  const handleStartTournament = async () => {
    const totalPlayersCount = selectedPlayerIds.length + guestPlayers.length;
    if (totalPlayersCount === 0) {
      alert('Debes agregar al menos un jugador para iniciar el torneo');
      return;
    }
    if (!selectedStructureId && structures.length === 0) {
      alert('Debes tener una estructura de ciegas configurada');
      return;
    }

    try {
      setLoading(true);
      
      // Determine payout structure JSON array
      let payoutStructure: number[] = [100];
      if (payoutOption === '1') payoutStructure = [50, 30, 20];
      else if (payoutOption === '2') payoutStructure = [70, 30];

      // Find structure levels to calculate initial time remaining
      let initialSeconds = 15 * 60; // fallback 15 mins
      const selectedStruct = structures.find(s => s.id === selectedStructureId);
      if (selectedStruct && selectedStruct.levels.length > 0) {
        initialSeconds = selectedStruct.levels[0].duration * 60;
      }

      // 1. Create Tournament row in Supabase
      const { data: tourney, error: tourneyError } = await supabase
        .from('tournaments')
        .insert({
          organizer_id: user?.id,
          name: name,
          status: 'running',
          buy_in_amount: Number(buyInAmount),
          buy_in_chips: Number(buyInChips),
          rebuy_amount: Number(rebuyAmount),
          rebuy_chips: Number(rebuyChips),
          add_on_amount: Number(addonAmount),
          add_on_chips: Number(addonChips),
          current_level_index: 0,
          seconds_remaining: initialSeconds,
          is_timer_running: false,
          max_players_per_table: Number(maxPlayersPerTable),
          payout_structure: payoutStructure,
          structure_id: selectedStructureId || null,
        })
        .select()
        .single();

      if (tourneyError) throw tourneyError;

      // 2. Perform Seat Draw (Seating Assignment)
      // List of all participants
      const participants: { player_id: string | null; guest_name: string | null }[] = [
        ...selectedPlayerIds.map(id => ({ player_id: id, guest_name: null })),
        ...guestPlayers.map(name => ({ player_id: null, guest_name: name }))
      ];

      // Shuffle participants randomly
      const shuffled = [...participants].sort(() => Math.random() - 0.5);

      // Assign tables and seats
      const tournamentPlayersData = shuffled.map((player, idx) => {
        const tableNumber = Math.floor(idx / maxPlayersPerTable) + 1;
        const seatNumber = (idx % maxPlayersPerTable) + 1;

        return {
          tournament_id: tourney.id,
          player_id: player.player_id,
          guest_name: player.guest_name,
          status: 'active',
          rebuys_count: 0,
          has_add_on: false,
          table_number: tableNumber,
          seat_number: seatNumber,
          elimination_position: null,
          payout_amount: 0,
        };
      });

      // 3. Write tournament players to Supabase
      const { error: playersError } = await supabase
        .from('tournament_players')
        .insert(tournamentPlayersData);

      if (playersError) throw playersError;

      // 4. Create initial log entry
      await supabase.from('tournament_logs').insert({
        tournament_id: tourney.id,
        event_type: 'timer_action',
        payload: { message: 'El torneo ha sido iniciado y los asientos fueron sorteados' }
      });

      // 5. Navigate to Control view
      onNavigate('control', tourney);

    } catch (err) {
      console.error('Error starting tournament:', err);
      alert('Error al iniciar el torneo en el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button className="btn btn-outline" style={styles.backBtn} onClick={step === 2 ? () => setStep(1) : onBack}>
          <ArrowLeft size={16} /> Volver
        </button>
        <h2 style={styles.title}>Configuración del Torneo</h2>
        <div style={styles.stepIndicator}>Paso {step} de 2</div>
      </div>

      {step === 1 ? (
        /* Step 1: Config Form */
        <div style={styles.grid}>
          {/* Settings panel */}
          <div className="glass-panel" style={styles.panel}>
            <h3 style={styles.sectionTitle}><Settings size={18} color="var(--color-primary)" /> Datos Generales</h3>
            
            <div className="form-group">
              <label className="form-label">Nombre del Torneo</label>
              <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div style={styles.formRow}>
              <div className="form-group">
                <label className="form-label">Máx Jugadores por Mesa</label>
                <select className="form-input" value={maxPlayersPerTable} onChange={(e) => setMaxPlayersPerTable(Number(e.target.value))}>
                  <option value="6">6 (Shorthanded)</option>
                  <option value="8">8 (Estándar)</option>
                  <option value="9">9 (Full Ring)</option>
                  <option value="10">10 (Casino Ring)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Estructura de Ciegas</label>
                <select className="form-input" value={selectedStructureId} onChange={(e) => setSelectedStructureId(e.target.value)}>
                  {structures.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  {structures.length === 0 && (
                    <option value="">No hay estructuras (Por favor, crea una primero)</option>
                  )}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Distribución de Premios</label>
              <select className="form-input" value={payoutOption} onChange={(e) => setPayoutOption(e.target.value)}>
                <option value="1">Top 3 pagados (50% - 30% - 20%)</option>
                <option value="2">Top 2 pagados (70% - 30%)</option>
                <option value="3">Ganador toma todo (100%)</option>
              </select>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', padding: '14px', marginTop: '20px' }} onClick={() => setStep(2)}>
              Siguiente: Registrar Jugadores <ChevronRight size={18} />
            </button>
          </div>

          {/* Chips & Financial Panel */}
          <div className="glass-panel" style={styles.panel}>
            <h3 style={styles.sectionTitle}><Shield size={18} color="var(--color-secondary)" /> Fichas y Precios</h3>

            <div style={styles.cardSection}>
              <h4 style={styles.subHeading}>Entrada Inicial (Buy-In)</h4>
              <div style={styles.formRow}>
                <div className="form-group">
                  <label className="form-label" style={styles.smallLabel}>Costo ($)</label>
                  <input type="number" className="form-input" value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={styles.smallLabel}>Fichas</label>
                  <input type="number" className="form-input" value={buyInChips} onChange={(e) => setBuyInChips(Number(e.target.value))} />
                </div>
              </div>
            </div>

            <div style={styles.cardSection}>
              <h4 style={styles.subHeading}>Recompra (Rebuy)</h4>
              <div style={styles.formRow}>
                <div className="form-group">
                  <label className="form-label" style={styles.smallLabel}>Costo ($)</label>
                  <input type="number" className="form-input" value={rebuyAmount} onChange={(e) => setRebuyAmount(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={styles.smallLabel}>Fichas</label>
                  <input type="number" className="form-input" value={rebuyChips} onChange={(e) => setRebuyChips(Number(e.target.value))} />
                </div>
              </div>
            </div>

            <div style={styles.cardSection}>
              <h4 style={styles.subHeading}>Adición (Add-On)</h4>
              <div style={styles.formRow}>
                <div className="form-group">
                  <label className="form-label" style={styles.smallLabel}>Costo ($)</label>
                  <input type="number" className="form-input" value={addonAmount} onChange={(e) => setAddonAmount(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={styles.smallLabel}>Fichas</label>
                  <input type="number" className="form-input" value={addonChips} onChange={(e) => setAddonChips(Number(e.target.value))} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Step 2: Players Selector & Seat Draw */
        <div style={styles.grid}>
          {/* Registered Players List */}
          <div className="glass-panel" style={styles.panel}>
            <div style={styles.panelHeader}>
              <h3 style={styles.sectionTitle}><Users size={18} color="var(--color-primary)" /> Registrar de Directorio</h3>
              <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={handleSelectAllPlayers}>
                {selectedPlayerIds.length === allPlayers.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
              </button>
            </div>

            <p style={styles.desc}>Selecciona los jugadores inscritos en tu directorio de jugadores locales:</p>

            {allPlayers.length === 0 ? (
              <div style={styles.emptyState}>No tienes jugadores registrados en el directorio.</div>
            ) : (
              <div style={styles.playersScroll}>
                {allPlayers.map((player) => {
                  const isSelected = selectedPlayerIds.includes(player.id);
                  return (
                    <div 
                      key={player.id} 
                      style={{ 
                        ...styles.playerSelectRow, 
                        borderColor: isSelected ? 'var(--color-primary)' : 'var(--border-color)',
                        backgroundColor: isSelected ? 'var(--color-primary-glow)' : 'transparent'
                      }}
                      onClick={() => handleTogglePlayer(player.id)}
                    >
                      <div style={styles.playerInfoCol}>
                        <div style={{
                          ...styles.checkbox,
                          backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                          borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)'
                        }}>
                          {isSelected && <Check size={12} color="#030712" />}
                        </div>
                        <span style={styles.playerName}>{player.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Guest / Fast Players & Launch */}
          <div className="glass-panel" style={styles.panel}>
            <h3 style={styles.sectionTitle}><Plus size={18} color="var(--color-secondary)" /> Invitados Rápidos</h3>
            <p style={styles.desc}>Agrega jugadores de forma directa para esta partida (no se guardarán en tu directorio global):</p>
            
            <div style={styles.addGuestBlock}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Nombre del Invitado" 
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
              />
              <button type="button" className="btn btn-outline" onClick={handleAddGuest}>Añadir</button>
            </div>

            {guestPlayers.length > 0 && (
              <div style={styles.guestList}>
                {guestPlayers.map((g, idx) => (
                  <div key={idx} style={styles.guestRow}>
                    <span>{g} (Invitado)</span>
                    <button style={styles.actionBtnDelete} onClick={() => handleRemoveGuest(idx)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.divider}></div>

            <div style={styles.summaryCard}>
              <h4 style={styles.summaryTitle}>Resumen del Torneo</h4>
              <div style={styles.summaryRow}>
                <span>Jugadores en total:</span>
                <span style={styles.summaryVal}>{selectedPlayerIds.length + guestPlayers.length}</span>
              </div>
              <div style={styles.summaryRow}>
                <span>Capacidad por mesa:</span>
                <span style={styles.summaryVal}>{maxPlayersPerTable} jugadores</span>
              </div>
              <div style={styles.summaryRow}>
                <span>Mesas requeridas:</span>
                <span style={styles.summaryVal}>{Math.ceil((selectedPlayerIds.length + guestPlayers.length) / maxPlayersPerTable)}</span>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '16px', fontSize: '1.05rem', fontWeight: 800, marginTop: '20px' }} 
              onClick={handleStartTournament}
              disabled={loading}
            >
              {loading ? 'Sorteando asientos...' : 'Realizar Sorteo e Iniciar Reloj'} <Play size={16} />
            </button>
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
  stepIndicator: {
    padding: '6px 14px',
    borderRadius: '100px',
    background: 'rgba(255, 255, 255, 0.05)',
    fontSize: '0.85rem',
    fontWeight: 650,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 1fr',
    gap: '30px',
  },
  panel: {
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  cardSection: {
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: '16px 20px',
    background: 'rgba(3, 7, 18, 0.2)',
  },
  subHeading: {
    fontSize: '0.95rem',
    fontWeight: 650,
    marginBottom: '12px',
    color: 'var(--color-text-secondary)',
  },
  smallLabel: {
    fontSize: '0.75rem',
  },
  desc: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.4,
  },
  playersScroll: {
    maxHeight: '380px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    border: '1px solid var(--border-color)',
    padding: '12px',
    borderRadius: 'var(--radius-md)',
  },
  playerSelectRow: {
    padding: '12px 16px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  playerInfoCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    border: '1px solid',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerName: {
    fontSize: '0.95rem',
  },
  emptyState: {
    padding: '30px 10px',
    textAlign: 'center',
    color: 'var(--color-text-muted)',
  },
  addGuestBlock: {
    display: 'flex',
    gap: '12px',
  },
  guestList: {
    maxHeight: '160px',
    overflowY: 'auto',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  guestRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.875rem',
    padding: '6px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
  },
  actionBtnDelete: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: 'none',
    color: 'var(--color-danger)',
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  divider: {
    height: '1px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    margin: '10px 0',
  },
  summaryCard: {
    background: 'rgba(255, 255, 255, 0.02)',
    padding: '16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255, 255, 255, 0.03)',
  },
  summaryTitle: {
    fontSize: '0.9rem',
    fontWeight: 700,
    marginBottom: '10px',
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.875rem',
    padding: '4px 0',
  },
  summaryVal: {
    fontWeight: 700,
    color: 'var(--color-primary)',
  },
};
