import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { BlindStructure, Level } from '../types';
import { Clock, Plus, Trash2, Edit2, ArrowLeft, Trash, Save } from 'lucide-react';

interface StructuresProps {
  onBack: () => void;
}

const PRESET_STRUCTURES = [
  {
    name: 'Turbo (10 min)',
    levels: [
      { level: 1, small_blind: 50, big_blind: 100, ante: 0, duration: 10 },
      { level: 2, small_blind: 100, big_blind: 200, ante: 0, duration: 10 },
      { level: 3, small_blind: 150, big_blind: 300, ante: 25, duration: 10 },
      { level: 4, small_blind: 200, big_blind: 400, ante: 50, duration: 10 },
      { level: 5, small_blind: 300, big_blind: 600, ante: 75, duration: 10 },
      { level: 6, small_blind: 400, big_blind: 800, ante: 100, duration: 10 },
      { level: 7, small_blind: 600, big_blind: 1200, ante: 200, duration: 10 },
      { level: 8, small_blind: 800, big_blind: 1600, ante: 200, duration: 10 },
      { level: 9, small_blind: 1000, big_blind: 2000, ante: 300, duration: 10 },
      { level: 10, small_blind: 1500, big_blind: 3000, ante: 500, duration: 10 },
    ]
  },
  {
    name: 'Estándar (15 min)',
    levels: [
      { level: 1, small_blind: 25, big_blind: 50, ante: 0, duration: 15 },
      { level: 2, small_blind: 50, big_blind: 100, ante: 0, duration: 15 },
      { level: 3, small_blind: 75, big_blind: 150, ante: 0, duration: 15 },
      { level: 4, small_blind: 100, big_blind: 200, ante: 25, duration: 15 },
      { level: 5, small_blind: 150, big_blind: 300, ante: 25, duration: 15 },
      { level: 6, small_blind: 200, big_blind: 400, ante: 50, duration: 15 },
      { level: 7, small_blind: 300, big_blind: 600, ante: 75, duration: 15 },
      { level: 8, small_blind: 400, big_blind: 800, ante: 100, duration: 15 },
      { level: 9, small_blind: 500, big_blind: 1000, ante: 100, duration: 15 },
      { level: 10, small_blind: 600, big_blind: 1200, ante: 200, duration: 15 },
      { level: 11, small_blind: 800, big_blind: 1600, ante: 200, duration: 15 },
      { level: 12, small_blind: 1000, big_blind: 2000, ante: 300, duration: 15 },
    ]
  },
  {
    name: 'Deepstack (20 min)',
    levels: [
      { level: 1, small_blind: 25, big_blind: 50, ante: 0, duration: 20 },
      { level: 2, small_blind: 50, big_blind: 100, ante: 0, duration: 20 },
      { level: 3, small_blind: 75, big_blind: 150, ante: 0, duration: 20 },
      { level: 4, small_blind: 100, big_blind: 200, ante: 0, duration: 20 },
      { level: 5, small_blind: 150, big_blind: 300, ante: 25, duration: 20 },
      { level: 6, small_blind: 200, big_blind: 400, ante: 50, duration: 20 },
      { level: 7, small_blind: 250, big_blind: 500, ante: 50, duration: 20 },
      { level: 8, small_blind: 300, big_blind: 600, ante: 75, duration: 20 },
      { level: 9, small_blind: 400, big_blind: 800, ante: 100, duration: 20 },
      { level: 10, small_blind: 500, big_blind: 1000, ante: 100, duration: 20 },
      { level: 11, small_blind: 600, big_blind: 1200, ante: 200, duration: 20 },
      { level: 12, small_blind: 800, big_blind: 1600, ante: 200, duration: 20 },
    ]
  }
];

export const Structures: React.FC<StructuresProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [structures, setStructures] = useState<BlindStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form fields for custom structure
  const [structureName, setStructureName] = useState('');
  const [levels, setLevels] = useState<Level[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Default values to bundle in the structure levels jsonb column
  const [defaultBuyInAmount, setDefaultBuyInAmount] = useState(10000);
  const [defaultBuyInChips, setDefaultBuyInChips] = useState(10000);
  const [defaultRebuyAmount, setDefaultRebuyAmount] = useState(10000);
  const [defaultRebuyChips, setDefaultRebuyChips] = useState(10000);
  const [defaultAddonAmount, setDefaultAddonAmount] = useState(10000);
  const [defaultAddonChips, setDefaultAddonChips] = useState(15000);
  const [defaultRakeAmount, setDefaultRakeAmount] = useState(3000);
  const [defaultPayoutOption, setDefaultPayoutOption] = useState('1');
  const [defaultPayout1, setDefaultPayout1] = useState(50);
  const [defaultPayout2, setDefaultPayout2] = useState(30);
  const [defaultPayout3, setDefaultPayout3] = useState(20);

  // Helper inputs for adding a level
  const [sb, setSb] = useState(100);
  const [bb, setBb] = useState(200);
  const [ante, setAnte] = useState(0);
  const [duration, setDuration] = useState(15);

  const [breakDuration, setBreakDuration] = useState(15);
  const [insertAfterLevelIdx, setInsertAfterLevelIdx] = useState(0);

  const getLevelsArray = (bsLevels: any): Level[] => {
    if (!bsLevels) return [];
    if (Array.isArray(bsLevels)) return bsLevels;
    return bsLevels.levels || [];
  };

  useEffect(() => {
    if (user) {
      fetchStructures();
    }
  }, [user]);

  const fetchStructures = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('blind_structures')
        .select('*')
        .order('name', { ascending: true });

      if (err) throw err;
      setStructures(data || []);
    } catch (err) {
      console.error('Error fetching structures:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLevel = () => {
    const standardLevelsCount = levels.filter(lvl => !lvl.is_break).length;
    const newLevel: Level = {
      level: standardLevelsCount + 1,
      small_blind: Number(sb),
      big_blind: Number(bb),
      ante: Number(ante),
      duration: Number(duration),
    };
    const updated = [...levels, newLevel];
    setLevels(updated);
    setInsertAfterLevelIdx(updated.length - 1);
    // Auto-increment blinds for easy next entry
    setSb(bb);
    setBb(bb * 2);
  };

  const handleRemoveLevel = (index: number) => {
    const filtered = levels.filter((_, i) => i !== index);
    let standardLevelCounter = 1;
    const reindexed = filtered.map((lvl) => {
      if (lvl.is_break) {
        return { ...lvl, level: 0 };
      } else {
        const currentCounter = standardLevelCounter;
        standardLevelCounter++;
        return { ...lvl, level: currentCounter };
      }
    });
    setLevels(reindexed);
    if (reindexed.length > 0) {
      setInsertAfterLevelIdx(Math.min(insertAfterLevelIdx, reindexed.length - 1));
    } else {
      setInsertAfterLevelIdx(0);
    }
  };

  const handleAddBreak = () => {
    if (levels.length === 0) {
      alert('Debes añadir al menos un nivel de ciegas antes de poder insertar un descanso.');
      return;
    }
    const idx = Number(insertAfterLevelIdx);
    if (idx < 0 || idx >= levels.length) {
      alert('Posición de inserción no válida.');
      return;
    }

    const updated = [...levels];
    const newBreak = {
      level: 0,
      small_blind: 0,
      big_blind: 0,
      ante: 0,
      duration: Number(breakDuration),
      is_break: true
    };
    updated.splice(idx + 1, 0, newBreak);

    // Re-index standard levels
    let standardLevelCounter = 1;
    const reindexed = updated.map((lvl) => {
      if (lvl.is_break) {
        return { ...lvl, level: 0 };
      } else {
        const currentCounter = standardLevelCounter;
        standardLevelCounter++;
        return { ...lvl, level: currentCounter };
      }
    });
    
    setLevels(reindexed);
    if (reindexed.length > idx + 2) {
      setInsertAfterLevelIdx(idx + 2);
    } else {
      setInsertAfterLevelIdx(reindexed.length - 1);
    }
  };

  const handleSave = async () => {
    if (!structureName.trim()) {
      alert('Por favor introduce un nombre para la estructura');
      return;
    }
    if (levels.length === 0) {
      alert('Debes agregar al menos un nivel de ciegas');
      return;
    }

    if (defaultPayoutOption === '1') {
      const sum = Number(defaultPayout1) + Number(defaultPayout2) + Number(defaultPayout3);
      if (sum !== 100) {
        alert(`Los porcentajes de premios para Top 3 deben sumar exactamente 100% (actual: ${sum}%)`);
        return;
      }
    } else if (defaultPayoutOption === '2') {
      const sum = Number(defaultPayout1) + Number(defaultPayout2);
      if (sum !== 100) {
        alert(`Los porcentajes de premios para Top 2 deben sumar exactamente 100% (actual: ${sum}%)`);
        return;
      }
    }

    const levelsPayload = {
      levels: levels,
      defaults: {
        buy_in_amount: Number(defaultBuyInAmount),
        buy_in_chips: Number(defaultBuyInChips),
        rebuy_amount: Number(defaultRebuyAmount),
        rebuy_chips: Number(defaultRebuyChips),
        add_on_amount: Number(defaultAddonAmount),
        add_on_chips: Number(defaultAddonChips),
        rake_amount: Number(defaultRakeAmount),
        payout_option: defaultPayoutOption,
        payout_structure: defaultPayoutOption === '1' ? [Number(defaultPayout1), Number(defaultPayout2), Number(defaultPayout3)] :
                          defaultPayoutOption === '2' ? [Number(defaultPayout1), Number(defaultPayout2)] : [100]
      }
    };

    try {
      if (editingId) {
        // Edit structure
        const { error: err } = await supabase
          .from('blind_structures')
          .update({
            name: structureName,
            levels: levelsPayload
          })
          .eq('id', editingId);

        if (err) throw err;
      } else {
        // Create new structure
        const { error: err } = await supabase
          .from('blind_structures')
          .insert({
            name: structureName,
            levels: levelsPayload,
            organizer_id: user?.id
          });

        if (err) throw err;
      }

      setIsEditing(false);
      setEditingId(null);
      setStructureName('');
      setLevels([]);
      fetchStructures();
    } catch (err) {
      console.error('Error saving structure:', err);
      alert('Error al guardar la estructura');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta estructura?')) {
      return;
    }

    try {
      const { error: err } = await supabase
        .from('blind_structures')
        .delete()
        .eq('id', id);

      if (err) throw err;
      fetchStructures();
    } catch (err) {
      console.error('Error deleting structure:', err);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button className="btn btn-outline" style={styles.backBtn} onClick={isEditing ? () => setIsEditing(false) : onBack}>
          <ArrowLeft size={16} /> Volver
        </button>
        <h2 style={styles.title}>{isEditing ? (editingId ? 'Editar Estructura' : 'Crear Nueva Estructura') : 'Estructuras de Ciegas'}</h2>
        {!isEditing && (
          <button className="btn btn-primary" onClick={() => {
            setIsEditing(true);
            setEditingId(null);
            setStructureName('');
            setLevels([
              { level: 1, small_blind: 50, big_blind: 100, ante: 0, duration: 15 },
              { level: 2, small_blind: 100, big_blind: 200, ante: 0, duration: 15 },
            ]);
            setSb(150);
            setBb(300);
            setAnte(25);
            setDuration(15);
          }}>
            <Plus size={16} /> Crear Estructura
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="structures-editor-grid" style={styles.editorContainer}>
          {/* Left panel: Info and add levels */}
          <div className="glass-panel" style={styles.editorLeft}>
            <h3 style={styles.subTitle}>Parámetros de la Estructura</h3>
            
            <div className="form-group">
              <label className="form-label">Nombre de la Estructura</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. Torneo Turbo Viernes"
                value={structureName}
                onChange={(e) => setStructureName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tiempo por Nivel (Minutos)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  className="form-input"
                  placeholder="15"
                  value={duration}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDuration(val);
                    // Actualizar todos los niveles existentes automáticamente al cambiar este valor
                    setLevels(prev => prev.map(lvl => ({ ...lvl, duration: val })));
                  }}
                  min="1"
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', padding: '0 12px' }}
                  onClick={() => {
                    setLevels(prev => prev.map(lvl => ({ ...lvl, duration: Number(duration) })));
                  }}
                  title="Aplica la duración actual a todos los niveles de la tabla"
                >
                  Aplicar a todos
                </button>
              </div>
              <small style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                Al cambiar esto, se actualizará el tiempo de todos los niveles en la tabla de la derecha.
              </small>
            </div>

            <div style={{ margin: '20px 0', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '12px' }}>Valores por Defecto del Torneo</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Buy-In ($ CLP)</label>
                  <input type="number" className="form-input" value={defaultBuyInAmount} onChange={(e) => setDefaultBuyInAmount(Number(e.target.value))} style={{ padding: '6px 10px', fontSize: '0.85rem' }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Rake ($ CLP)</label>
                  <input type="number" className="form-input" value={defaultRakeAmount} onChange={(e) => setDefaultRakeAmount(Number(e.target.value))} style={{ padding: '6px 10px', fontSize: '0.85rem' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Recompra ($ CLP)</label>
                  <input type="number" className="form-input" value={defaultRebuyAmount} onChange={(e) => setDefaultRebuyAmount(Number(e.target.value))} style={{ padding: '6px 10px', fontSize: '0.85rem' }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Add-On ($ CLP)</label>
                  <input type="number" className="form-input" value={defaultAddonAmount} onChange={(e) => setDefaultAddonAmount(Number(e.target.value))} style={{ padding: '6px 10px', fontSize: '0.85rem' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '4px' }}>Fichas Buy-In</label>
                  <input type="number" className="form-input" value={defaultBuyInChips} onChange={(e) => setDefaultBuyInChips(Number(e.target.value))} style={{ padding: '4px 8px', fontSize: '0.8rem' }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '4px' }}>Fichas Rebuy</label>
                  <input type="number" className="form-input" value={defaultRebuyChips} onChange={(e) => setDefaultRebuyChips(Number(e.target.value))} style={{ padding: '4px 8px', fontSize: '0.8rem' }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '4px' }}>Fichas Add-On</label>
                  <input type="number" className="form-input" value={defaultAddonChips} onChange={(e) => setDefaultAddonChips(Number(e.target.value))} style={{ padding: '4px 8px', fontSize: '0.8rem' }} />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Distribución de Premios</label>
                <select className="form-input" value={defaultPayoutOption} onChange={(e) => {
                  const val = e.target.value;
                  setDefaultPayoutOption(val);
                  if (val === '1') {
                    setDefaultPayout1(50);
                    setDefaultPayout2(30);
                    setDefaultPayout3(20);
                  } else if (val === '2') {
                    setDefaultPayout1(70);
                    setDefaultPayout2(30);
                  }
                }} style={{ padding: '6px 10px', fontSize: '0.85rem' }}>
                  <option value="1">Top 3 pagados (Personalizado)</option>
                  <option value="2">Top 2 pagados (Personalizado)</option>
                  <option value="3">Ganador toma todo (100%)</option>
                </select>
              </div>

              {defaultPayoutOption === '1' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '2px' }}>1° Lugar (%)</label>
                    <input type="number" className="form-input" value={defaultPayout1} onChange={(e) => setDefaultPayout1(Number(e.target.value))} style={{ padding: '6px 8px', fontSize: '0.8rem' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '2px' }}>2° Lugar (%)</label>
                    <input type="number" className="form-input" value={defaultPayout2} onChange={(e) => setDefaultPayout2(Number(e.target.value))} style={{ padding: '6px 8px', fontSize: '0.8rem' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '2px' }}>3° Lugar (%)</label>
                    <input type="number" className="form-input" value={defaultPayout3} onChange={(e) => setDefaultPayout3(Number(e.target.value))} style={{ padding: '6px 8px', fontSize: '0.8rem' }} />
                  </div>
                </div>
              )}
              {defaultPayoutOption === '2' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>1° Lugar (%)</label>
                    <input type="number" className="form-input" value={defaultPayout1} onChange={(e) => setDefaultPayout1(Number(e.target.value))} style={{ padding: '6px 10px', fontSize: '0.85rem' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>2° Lugar (%)</label>
                    <input type="number" className="form-input" value={defaultPayout2} onChange={(e) => setDefaultPayout2(Number(e.target.value))} style={{ padding: '6px 10px', fontSize: '0.85rem' }} />
                  </div>
                </div>
              )}
            </div>

            <div style={styles.addLevelBlock}>
              <h4 style={styles.levelBlockTitle}>Añadir Siguiente Nivel</h4>
              <div style={styles.addLevelGrid}>
                <div className="form-group">
                  <label className="form-label" style={styles.smallLabel}>Ciega Chica</label>
                  <input type="number" className="form-input" value={sb} onChange={(e) => setSb(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={styles.smallLabel}>Ciega Grande</label>
                  <input type="number" className="form-input" value={bb} onChange={(e) => setBb(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={styles.smallLabel}>Ante</label>
                  <input type="number" className="form-input" value={ante} onChange={(e) => setAnte(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={styles.smallLabel}>Tiempo (Min)</label>
                  <input type="number" className="form-input" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                </div>
              </div>
              <button type="button" className="btn btn-outline" style={{ width: '100%', marginTop: '10px' }} onClick={handleAddLevel}>
                <Plus size={16} /> Añadir Nivel {levels.filter(lvl => !lvl.is_break).length + 1}
              </button>
            </div>

            <div style={{ ...styles.addLevelBlock, marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
              <h4 style={styles.levelBlockTitle}>Añadir Break / Descanso</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label" style={styles.smallLabel}>Insertar después del nivel:</label>
                  <select className="form-input" value={insertAfterLevelIdx} onChange={(e) => setInsertAfterLevelIdx(Number(e.target.value))} style={{ padding: '6px', fontSize: '0.85rem' }}>
                    {levels.map((lvl, idx) => (
                      <option key={idx} value={idx}>
                        {lvl.is_break ? `Pos. ${idx + 1}: Descanso (${lvl.duration} min)` : `Pos. ${idx + 1}: Nivel ${lvl.level} ($${lvl.small_blind}/$${lvl.big_blind})`}
                      </option>
                    ))}
                    {levels.length === 0 && (
                      <option value="0">Crea algún nivel primero</option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={styles.smallLabel}>Duración Break (Min)</label>
                  <input type="number" className="form-input" value={breakDuration} onChange={(e) => setBreakDuration(Number(e.target.value))} style={{ padding: '6px', fontSize: '0.85rem' }} />
                </div>
              </div>
              <button type="button" className="btn btn-outline" style={{ width: '100%', marginTop: '10px', borderColor: '#10b981', color: '#10b981' }} onClick={handleAddBreak}>
                <Plus size={16} /> Añadir Descanso / Break
              </button>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', padding: '14px', marginTop: '20px' }} onClick={handleSave}>
              <Save size={18} /> Guardar Plantilla de Ciegas
            </button>
          </div>

          {/* Right panel: levels preview */}
          <div className="glass-panel" style={styles.editorRight}>
            <h3 style={styles.subTitle}>Niveles Configurados ({levels.length})</h3>
            
            {levels.length === 0 ? (
              <div style={styles.emptyLevels}>No has añadido niveles de ciegas aún.</div>
            ) : (
              <div className="table-responsive" style={styles.levelsTableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>Nivel</th>
                      <th style={styles.th}>Ciega Chica</th>
                      <th style={styles.th}>Ciega Grande</th>
                      <th style={styles.th}>Ante</th>
                      <th style={styles.th}>Duración</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Eliminar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {levels.map((lvl, idx) => (
                      <tr key={idx} style={{
                        ...styles.tr,
                        background: lvl.is_break ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                        borderLeft: lvl.is_break ? '4px solid #10b981' : 'none'
                      }}>
                        <td style={{ ...styles.td, fontWeight: 700 }}>
                          {lvl.is_break ? (
                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>BREAK</span>
                          ) : (
                            `#${lvl.level}`
                          )}
                        </td>
                        <td style={styles.td}>{lvl.is_break ? '-' : `$${lvl.small_blind.toLocaleString()}`}</td>
                        <td style={styles.td}>{lvl.is_break ? '-' : `$${lvl.big_blind.toLocaleString()}`}</td>
                        <td style={styles.td}>{lvl.is_break ? '-' : `$${lvl.ante.toLocaleString()}`}</td>
                        <td style={styles.td}>{lvl.duration} Min</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <button style={styles.actionBtnDelete} onClick={() => handleRemoveLevel(idx)}>
                            <Trash size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="structures-list-grid" style={styles.listGrid}>
          {/* Custom user structures */}
          <div className="glass-panel" style={styles.customSection}>
            <h3 style={styles.sectionHeading}>Tus Estructuras Guardadas</h3>
            {loading ? (
              <div style={styles.loading}>Cargando estructuras...</div>
            ) : structures.length === 0 ? (
              <div style={styles.emptyState}>
                <Clock size={40} color="var(--color-text-muted)" style={{ marginBottom: '12px' }} />
                <p>No tienes estructuras guardadas.</p>
              </div>
            ) : (
              <div style={styles.structuresList}>
                {structures.map((s) => {
                  const lvlArray = getLevelsArray(s.levels);
                  const hasDefaults = !Array.isArray(s.levels) && (s.levels as any).defaults;
                  return (
                    <div key={s.id} style={styles.structureRow}>
                      <div style={styles.structureInfo}>
                        <span style={styles.structureName}>{s.name}</span>
                        <span style={styles.structureSub}>{lvlArray.length} Niveles de Ciegas</span>
                      </div>
                      <div style={styles.actions}>
                        <button style={styles.actionBtnEdit} onClick={() => {
                          setEditingId(s.id);
                          setStructureName(s.name);
                          setLevels(lvlArray);
                          if (lvlArray.length > 0) {
                            setDuration(lvlArray[0].duration);
                          }
                          if (hasDefaults) {
                            const defs = (s.levels as any).defaults;
                            setDefaultBuyInAmount(defs.buy_in_amount || 0);
                            setDefaultBuyInChips(defs.buy_in_chips || 0);
                            setDefaultRebuyAmount(defs.rebuy_amount || 0);
                            setDefaultRebuyChips(defs.rebuy_chips || 0);
                            setDefaultAddonAmount(defs.add_on_amount || 0);
                            setDefaultAddonChips(defs.add_on_chips || 0);
                            setDefaultRakeAmount(defs.rake_amount || 0);
                            setDefaultPayoutOption(defs.payout_option || '1');
                            if (defs.payout_structure && Array.isArray(defs.payout_structure)) {
                              const arr = defs.payout_structure;
                              if (arr.length === 3) {
                                setDefaultPayout1(arr[0] || 50);
                                setDefaultPayout2(arr[1] || 30);
                                setDefaultPayout3(arr[2] || 20);
                              } else if (arr.length === 2) {
                                setDefaultPayout1(arr[0] || 70);
                                setDefaultPayout2(arr[1] || 30);
                              }
                            }
                          } else {
                            setDefaultBuyInAmount(10000);
                            setDefaultBuyInChips(10000);
                            setDefaultRebuyAmount(10000);
                            setDefaultRebuyChips(10000);
                            setDefaultAddonAmount(10000);
                            setDefaultAddonChips(15000);
                            setDefaultRakeAmount(3000);
                            setDefaultPayoutOption('1');
                            setDefaultPayout1(50);
                            setDefaultPayout2(30);
                            setDefaultPayout3(20);
                          }
                          setIsEditing(true);
                        }}>
                          <Edit2 size={16} />
                        </button>
                        <button style={styles.actionBtnDelete} onClick={() => handleDelete(s.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Standard system presets */}
          <div className="glass-panel" style={styles.presetsSection}>
            <h3 style={styles.sectionHeading}>Plantillas del Sistema</h3>
            <div style={styles.presetsList}>
              {PRESET_STRUCTURES.map((preset, idx) => (
                <div key={idx} style={styles.presetRow}>
                  <div style={styles.structureInfo}>
                    <span style={styles.structureName}>{preset.name}</span>
                    <span style={styles.structureSub}>{preset.levels.length} Niveles de Ciegas</span>
                  </div>
                  <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => {
                    setEditingId(null);
                    setStructureName(`Copia de ${preset.name}`);
                    setLevels(preset.levels);
                    if (preset.levels && preset.levels.length > 0) {
                      setDuration(preset.levels[0].duration);
                    }
                    setIsEditing(true);
                  }}>
                    Copiar y Editar <Plus size={14} />
                  </button>
                </div>
              ))}
            </div>
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
  listGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '30px',
  },
  customSection: {
    padding: '30px',
    minHeight: '400px',
  },
  presetsSection: {
    padding: '30px',
  },
  sectionHeading: {
    fontSize: '1.2rem',
    fontWeight: 700,
    marginBottom: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '12px',
  },
  structuresList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  structureRow: {
    padding: '16px 20px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    background: 'rgba(255, 255, 255, 0.01)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  structureInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  structureName: {
    fontSize: '1rem',
    fontWeight: 650,
  },
  structureSub: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
  },
  presetsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  presetRow: {
    padding: '16px 20px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    background: 'rgba(255, 255, 255, 0.01)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: {
    display: 'flex',
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
  },
  editorContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.3fr',
    gap: '30px',
  },
  editorLeft: {
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  editorRight: {
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  subTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    marginBottom: '10px',
  },
  addLevelBlock: {
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: '20px',
    background: 'rgba(3, 7, 18, 0.2)',
  },
  levelBlockTitle: {
    fontSize: '0.95rem',
    fontWeight: 650,
    marginBottom: '14px',
    color: 'var(--color-text-secondary)',
  },
  addLevelGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  smallLabel: {
    fontSize: '0.75rem',
    letterSpacing: '0.02em',
  },
  emptyLevels: {
    padding: '40px',
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    border: '1px dashed rgba(255, 255, 255, 0.08)',
    borderRadius: 'var(--radius-md)',
  },
  levelsTableContainer: {
    maxHeight: '480px',
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
  },
};
