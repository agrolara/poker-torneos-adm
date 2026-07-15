import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { Zap, Key, Eye, EyeOff, Shield, Tv, Users, Landmark, Award, ArrowRight } from 'lucide-react';
import logoImg from '../assets/logo1.png';

export const Landing: React.FC = () => {
  const { signIn, signUp } = useAuth();
  
  // Modal states for "Acceso a tu liga"
  const [showLeagueModal, setShowLeagueModal] = useState(false);
  
  // Code entry states
  const [leagueCode, setLeagueCode] = useState('');
  const [leagueError, setLeagueError] = useState('');
  const [leagueSuccess, setLeagueSuccess] = useState('');
  const [leagueLoading, setLeagueLoading] = useState(false);

  // Super Admin modal states
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Explorer States
  const [showExplorerModal, setShowExplorerModal] = useState(false);
  const [dbStructures, setDbStructures] = useState<any[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<any | null>(null);
  const [simPlayers, setSimPlayers] = useState<number | ''>(10);
  const [simBuyIn, setSimBuyIn] = useState<number | ''>(10000);

  const FALLBACK_DEFAULTS = {
    buy_in: 10000,
    rake: 3000,
    payout_structure: [50, 30, 20]
  };

  const PRESETS = [
    {
      id: 'preset-turbo',
      name: 'Turbo Preset',
      levels: {
        levels: [
          { level: 1, small_blind: 100, big_blind: 200, ante: 0, duration: 10, is_break: false },
          { level: 2, small_blind: 200, big_blind: 400, ante: 0, duration: 10, is_break: false },
          { level: 3, small_blind: 300, big_blind: 600, ante: 50, duration: 10, is_break: false },
          { level: 4, small_blind: 0, big_blind: 0, ante: 0, duration: 5, is_break: true },
          { level: 5, small_blind: 400, big_blind: 800, ante: 100, duration: 10, is_break: false }
        ],
        defaults: { buy_in: 10000, rake: 1000, payout_structure: [50, 30, 20] }
      }
    },
    {
      id: 'preset-estandar',
      name: 'Estándar Preset',
      levels: {
        levels: [
          { level: 1, small_blind: 100, big_blind: 200, ante: 0, duration: 15, is_break: false },
          { level: 2, small_blind: 200, big_blind: 400, ante: 0, duration: 15, is_break: false },
          { level: 3, small_blind: 300, big_blind: 600, ante: 50, duration: 15, is_break: false },
          { level: 4, small_blind: 0, big_blind: 0, ante: 0, duration: 10, is_break: true },
          { level: 5, small_blind: 400, big_blind: 800, ante: 100, duration: 15, is_break: false }
        ],
        defaults: { buy_in: 15000, rake: 1500, payout_structure: [50, 30, 20] }
      }
    },
    {
      id: 'preset-deepstack',
      name: 'Deepstack Preset',
      levels: {
        levels: [
          { level: 1, small_blind: 100, big_blind: 200, ante: 0, duration: 20, is_break: false },
          { level: 2, small_blind: 150, big_blind: 300, ante: 0, duration: 20, is_break: false },
          { level: 3, small_blind: 200, big_blind: 400, ante: 0, duration: 20, is_break: false },
          { level: 4, small_blind: 250, big_blind: 500, ante: 50, duration: 20, is_break: false },
          { level: 5, small_blind: 0, big_blind: 0, ante: 0, duration: 10, is_break: true },
          { level: 6, small_blind: 300, big_blind: 600, ante: 50, duration: 20, is_break: false }
        ],
        defaults: { buy_in: 20000, rake: 2000, payout_structure: [40, 30, 20, 10] }
      }
    }
  ];

  const fetchStructures = async () => {
    setDbLoading(true);
    setDbError(null);
    try {
      const { data, error } = await supabase
        .from('blind_structures')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        setDbError(error.message);
      } else {
        setDbStructures(data || []);
      }
    } catch (err: any) {
      setDbError(err.message || 'Error al conectar con la base de datos');
    } finally {
      setDbLoading(false);
    }
  };

  const handleSelectStructure = (struct: any) => {
    setSelectedStructure(struct);
    let defaults = FALLBACK_DEFAULTS;
    if (struct.levels && !Array.isArray(struct.levels) && typeof struct.levels === 'object') {
      defaults = {
        buy_in: struct.levels.defaults?.buy_in ?? FALLBACK_DEFAULTS.buy_in,
        rake: struct.levels.defaults?.rake ?? FALLBACK_DEFAULTS.rake,
        payout_structure: struct.levels.defaults?.payout_structure ?? FALLBACK_DEFAULTS.payout_structure
      };
    }
    setSimPlayers(10);
    setSimBuyIn(defaults.buy_in);
  };

  const handlePlayersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setSimPlayers('');
      return;
    }
    let parsed = parseFloat(val);
    if (isNaN(parsed)) {
      setSimPlayers(0);
    } else {
      parsed = Math.round(parsed);
      if (parsed < 0) parsed = 0;
      setSimPlayers(parsed);
    }
  };

  const handleBuyInChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setSimBuyIn('');
      return;
    }
    let parsed = parseFloat(val);
    if (isNaN(parsed)) {
      setSimBuyIn(0);
    } else {
      if (parsed < 0) parsed = 0;
      setSimBuyIn(parsed);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setShowExplorerModal(false);
      setSelectedStructure(null);
    }
  };

  const getSelectedStructureDetails = () => {
    if (!selectedStructure) return { levels: [], defaults: FALLBACK_DEFAULTS };
    let levels: any[] = [];
    let defaults = FALLBACK_DEFAULTS;
    if (Array.isArray(selectedStructure.levels)) {
      levels = selectedStructure.levels;
    } else if (selectedStructure.levels && typeof selectedStructure.levels === 'object') {
      levels = selectedStructure.levels.levels || [];
      defaults = {
        buy_in: selectedStructure.levels.defaults?.buy_in ?? FALLBACK_DEFAULTS.buy_in,
        rake: selectedStructure.levels.defaults?.rake ?? FALLBACK_DEFAULTS.rake,
        payout_structure: selectedStructure.levels.defaults?.payout_structure ?? FALLBACK_DEFAULTS.payout_structure
      };
    }
    return { levels, defaults };
  };

  const { levels: currentLevels, defaults: currentDefaults } = getSelectedStructureDetails();

  const numPlayers = simPlayers === '' ? 0 : simPlayers;
  const numBuyIn = simBuyIn === '' ? 0 : simBuyIn;
  const rakePerPlayer = Math.min(numBuyIn, currentDefaults.rake ?? 0);

  const grossPool = numPlayers * numBuyIn;
  const rakeDeduction = numPlayers * rakePerPlayer;
  const netPool = Math.max(0, grossPool - rakeDeduction);

  const payoutStructure = currentDefaults.payout_structure || [100];

  const prizeRows = payoutStructure.map((percentage, index) => {
    const position = index + 1;
    const prizeAmount = Math.round((netPool * percentage) / 100);
    return {
      position,
      percentage,
      amount: prizeAmount
    };
  });

  const formatAmount = (num: number) => {
    if (num === 0) return '0';
    return Math.round(num).toLocaleString('es-CL');
  };

  // Super Admin Login handler
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminLoading(true);

    try {
      const { error: err } = await signIn(adminEmail, adminPassword);
      if (err) {
        setAdminError(err.message || 'Credenciales incorrectas.');
      } else {
        setShowAdminModal(false);
      }
    } catch (err) {
      setAdminError('Ocurrió un error inesperado');
    } finally {
      setAdminLoading(false);
    }
  };

  // Handle Client access transparently by league code
  const handleLeagueAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeagueError('');
    setLeagueSuccess('');
    setLeagueLoading(true);

    const cleanCode = leagueCode.trim().toUpperCase();
    if (!cleanCode) {
      setLeagueError('El código de liga es requerido.');
      setLeagueLoading(false);
      return;
    }

    try {
      // 1. Verify if code is valid in league_codes table
      const { data: codeData, error: codeErr } = await supabase
        .from('league_codes')
        .select('*')
        .eq('code', cleanCode)
        .single();

      if (codeErr || !codeData) {
        setLeagueError('El código de liga ingresado no es válido o no existe.');
        setLeagueLoading(false);
        return;
      }

      // Generate deterministic credentials based on league code
      const email = `liga-${cleanCode.toLowerCase()}@poker.com`;
      const password = `pwd-${cleanCode.toLowerCase()}-poker`;
      const name = codeData.client_name && codeData.client_name !== 'Sin Nombre' 
        ? codeData.client_name 
        : `Liga ${cleanCode}`;

      if (!codeData.used_by) {
        // Activate code (first time use - signs up and registers profile/claims code)
        const { error: signUpError } = await signUp(email, password, name, cleanCode);
        if (signUpError) {
          setLeagueError('Error al activar la liga: ' + signUpError.message);
        } else {
          setLeagueSuccess('¡Liga activada con éxito! Redirigiendo...');
          setTimeout(() => {
            setShowLeagueModal(false);
            setLeagueSuccess('');
          }, 1500);
        }
      } else {
        // Login directly (already activated)
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setLeagueError('Error al ingresar: ' + signInError.message);
        } else {
          setShowLeagueModal(false);
        }
      }
    } catch (err) {
      setLeagueError('Ocurrió un error inesperado');
    } finally {
      setLeagueLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Floating Poker Suits with subtle motion */}
      <div className="poker-suit spade">♠</div>
      <div className="poker-suit heart">♥</div>
      <div className="poker-suit club">♣</div>
      <div className="poker-suit diamond">♦</div>

      {/* Background glow effects */}
      <div style={styles.glow1}></div>
      <div style={styles.glow2}></div>

      {/* Header section with Logo, OAuth, and Action Buttons */}
      <header className="glass-panel app-header" style={styles.header}>
        <div style={styles.logoWrapper}>
          <img src={logoImg} alt="Logo" style={styles.logo} />
          <span style={styles.logoText}>Poker Director</span>
        </div>
        <div className="app-nav" style={styles.headerActions}>
          <button 
            className="btn btn-outline" 
            style={styles.adminBtn}
            onClick={() => {
              setAdminEmail('');
              setAdminPassword('');
              setAdminError('');
              setShowAdminModal(true);
            }}
          >
            <Shield size={15} style={{ marginRight: '6px', color: '#f59e0b' }} />
            Acceso Super Admin
          </button>

          <button 
            className="btn btn-outline" 
            style={styles.ligaBtn}
            onClick={() => setShowLeagueModal(true)}
          >
            <Key size={15} style={{ marginRight: '6px' }} />
            Acceso a tu liga
          </button>

          <button
            className="btn btn-outline"
            style={styles.explorarBtn}
            data-testid="btn-explorar-estructuras"
            onClick={() => {
              setShowExplorerModal(true);
              fetchStructures();
            }}
          >
            <Zap size={15} style={{ marginRight: '6px', color: '#10b981' }} />
            Explorar Estructuras
          </button>
          
          <a 
            href="https://wa.me/56993005959" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="whatsapp-premium-btn"
          >
            <svg style={styles.whatsappIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.386 9.807-9.78.002-2.613-1.013-5.074-2.86-6.92C16.315 2.059 13.859 1.042 11.25 1.042c-5.41 0-9.81 4.387-9.814 9.78-.002 1.704.447 3.37 1.287 4.853L1.68 20.306l4.967-1.152zM17.487 14.39c-.314-.157-1.857-.915-2.147-1.02-.29-.105-.5-.157-.712.157-.21.314-.818 1.02-.818 1.02-.21.262-.42.315-.733.157-1.637-.629-2.92-1.258-4.084-3.26-.31-.53.31-.49.886-.98.156-.156.262-.262.366-.418.105-.157.052-.314-.026-.47-.079-.158-.713-1.716-.977-2.35-.262-.629-.533-.53-.733-.54-.2-.01-.42-.015-.63-.015s-.556.079-.846.398c-.29.314-1.11 1.085-1.11 2.646s1.14 3.072 1.298 3.282c.157.21 2.23 3.407 5.4 4.773 1.157.498 2.062.8 2.766 1.023.754.238 1.44.204 1.98.123.6-.09 1.857-.76 2.12-1.493.262-.733.262-1.36.183-1.493-.079-.131-.29-.21-.603-.367z" />
            </svg>
            Contáctame
          </a>
        </div>
      </header>

      {/* Main Grid: Left copy & showcase image, Right Features Showcase */}
      <div className="landing-hero-grid" style={styles.heroSection}>
        <div style={styles.leftColumn}>
          <div style={styles.badge}>
            <Zap size={14} color="#f59e0b" />
            <span>PLATAFORMA PÓKER SAAS PROFESIONAL</span>
          </div>
          <h1 style={styles.title}>
            Lleva tus Torneos al <br />
            <span style={styles.titleGradient}>Siguiente Nivel</span>
          </h1>
          
          <p style={styles.subtitle}>
            Administra partidas de una o múltiples mesas de forma profesional. Sorteo de asientos, balanceo automático, reloj de blinds dinámico y proyección completa para TV con voz inteligente.
          </p>

          {/* Optimized Interface Mockup (Video) */}
          <div style={styles.mockupContainer}>
            <video 
              src="/video_landing.mp4"
              autoPlay 
              loop 
              muted 
              playsInline 
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: '10px',
                display: 'block',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
              }}
            />
            <div style={styles.mockupGlow}></div>
          </div>
        </div>

        {/* Right column: replace login form with App Functions/Features list */}
        <div style={styles.rightColumn}>
          <div className="glass-panel" style={styles.featuresCard}>
            <div style={styles.featuresCardHeader}>
              <h2 style={styles.featuresCardTitle}>Funcionalidades Clave</h2>
              <p style={styles.featuresCardSubtitle}>
                Todo lo que necesitas para dirigir torneos de póker profesionales y organizar tus ligas en un solo lugar.
              </p>
            </div>

            <div style={styles.featuresList}>
              <div className="feature-item" style={styles.featureItem}>
                <div style={{ ...styles.iconWrapper, backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                  <Tv size={20} color="var(--color-primary)" />
                </div>
                <div>
                  <h4 style={styles.featureTitle}>Reloj de Blinds en TV</h4>
                  <p style={styles.featureDesc}>Pantalla completa optimizada para pantallas con avisos de voz configurables.</p>
                </div>
              </div>

              <div className="feature-item" style={styles.featureItem}>
                <div style={{ ...styles.iconWrapper, backgroundColor: 'rgba(99, 102, 241, 0.1)' }}>
                  <Users size={20} color="var(--color-accent)" />
                </div>
                <div>
                  <h4 style={styles.featureTitle}>Balanceo Automático</h4>
                  <p style={styles.featureDesc}>Algoritmo inteligente para redistribución de mesas y asientos al eliminarse jugadores.</p>
                </div>
              </div>

              <div className="feature-item" style={styles.featureItem}>
                <div style={{ ...styles.iconWrapper, backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                  <Landmark size={20} color="var(--color-secondary)" />
                </div>
                <div>
                  <h4 style={styles.featureTitle}>Control de Recompras y Premios</h4>
                  <p style={styles.featureDesc}>Gestión financiera del torneo: registro de rebuys, add-ons y división de bolsa total.</p>
                </div>
              </div>

              <div className="feature-item" style={styles.featureItem}>
                <div style={{ ...styles.iconWrapper, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                  <Award size={20} color="#ef4444" />
                </div>
                <div>
                  <h4 style={styles.featureTitle}>Ranking de Ligas y Líderes</h4>
                  <p style={styles.featureDesc}>Historial acumulativo para premiar la constancia de los jugadores de tu club.</p>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={styles.startBtn}
              onClick={() => {
                setLeagueCode('');
                setLeagueError('');
                setLeagueSuccess('');
                setShowLeagueModal(true);
              }}
            >
              Comenzar ahora
              <ArrowRight size={18} style={{ marginLeft: '6px' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Acceso a tu liga Modal */}
      {showLeagueModal && (
        <div style={styles.modalOverlay}>
          <div className="glass-panel" style={styles.modalContent}>
            {/* Modal Close Button */}
            <button 
              type="button" 
              onClick={() => {
                setShowLeagueModal(false);
                setLeagueError('');
                setLeagueSuccess('');
              }}
              style={styles.modalCloseX}
            >
              &times;
            </button>

            <form onSubmit={handleLeagueAccess} style={styles.modalForm}>
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <Key size={40} color="#f59e0b" />
              </div>
              <h3 style={{ ...styles.modalTitle, textAlign: 'center' }}>Acceso a tu Liga</h3>
              <p style={{ ...styles.modalSubtitle, textAlign: 'center' }}>Ingresa tu Código de Liga para acceder de forma inmediata a la administración de tus torneos.</p>
              
              {leagueError && <div style={styles.errorAlert}>{leagueError}</div>}
              {leagueSuccess && <div style={styles.successAlert}>{leagueSuccess}</div>}
              
              <div className="form-group">
                <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>Código de Liga / Invitación</label>
                <input
                  type="text"
                  className="form-input"
                  style={styles.modalCodeInput}
                  placeholder="LIGA-XXXXXX"
                  value={leagueCode}
                  onChange={(e) => setLeagueCode(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={styles.submitBtn}
                disabled={leagueLoading}
              >
                {leagueLoading ? 'Ingresando...' : 'Ingresar a mi Liga'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin Login Modal */}
      {showAdminModal && (
        <div style={styles.modalOverlay}>
          <div className="glass-panel" style={styles.modalContent}>
            <button 
              type="button" 
              onClick={() => {
                setShowAdminModal(false);
                setAdminError('');
              }}
              style={styles.modalCloseX}
            >
              &times;
            </button>

            <form onSubmit={handleAdminLogin} style={styles.modalForm}>
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <Shield size={40} color="#f59e0b" />
              </div>
              <h3 style={{ ...styles.modalTitle, textAlign: 'center' }}>Acceso Super Admin</h3>
              <p style={{ ...styles.modalSubtitle, textAlign: 'center' }}>Ingresa tus credenciales de administrador para gestionar la plataforma.</p>
              
              {adminError && <div style={styles.errorAlert}>{adminError}</div>}
              
              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="admin@correo.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="••••••••"
                    style={{ paddingRight: '40px' }}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    style={styles.passwordToggle}
                  >
                    {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ ...styles.submitBtn, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
                disabled={adminLoading}
              >
                {adminLoading ? 'Ingresando...' : 'Ingresar como Administrador'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Explorar Estructuras Modal */}
      {showExplorerModal && (
        <div 
          style={styles.modalExplorerOverlay} 
          data-testid="modal-explorar-estructuras"
          onClick={handleOverlayClick}
        >
          <div className="glass-panel" style={styles.modalExplorerContent}>
            {/* Modal Title / Header */}
            <div style={styles.modalExplorerHeader}>
              <h3 data-testid="modal-title" style={styles.modalTitle}>
                {selectedStructure 
                  ? `Estructura: ${selectedStructure.name}` 
                  : 'Explorar Estructuras de Blinds'}
              </h3>
              <button
                type="button"
                data-testid="modal-close-btn"
                onClick={() => {
                  setShowExplorerModal(false);
                  setSelectedStructure(null);
                }}
                style={styles.modalCloseX}
              >
                &times;
              </button>
            </div>

            {selectedStructure ? (
              /* DETAIL VIEW */
              <div style={styles.detailContainer}>
                {/* Back button */}
                <button
                  type="button"
                  data-testid="detail-back-btn"
                  onClick={() => setSelectedStructure(null)}
                  style={styles.backBtn}
                >
                  &larr; Volver a la lista
                </button>

                <div style={styles.detailGrid}>
                  {/* Left column: Level list */}
                  <div style={styles.levelsCol}>
                    <h4 style={styles.sectionTitle}>Blinds y Descansos</h4>
                    <div 
                      data-testid="levels-container" 
                      className="levels-container scroll"
                      style={styles.levelsContainer}
                    >
                      <table style={styles.levelsTable}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Lvl</th>
                            <th style={styles.th}>Ciegas</th>
                            <th style={styles.th}>Ante</th>
                            <th style={styles.th}>Duración</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentLevels.map((lvl, index) => {
                            if (lvl.is_break) {
                              return (
                                <tr 
                                  key={index} 
                                  data-testid={`break-row-${index + 1}`}
                                  className="break-row green"
                                  style={styles.breakRow}
                                >
                                  <td colSpan={4} style={styles.breakCell}>
                                    Descanso: {lvl.duration} min
                                  </td>
                                </tr>
                              );
                            } else {
                              return (
                                <tr 
                                  key={index} 
                                  data-testid={`level-row-${lvl.level}`}
                                  style={styles.levelRow}
                                >
                                  <td style={styles.td}>{lvl.level}</td>
                                  <td style={styles.td}>
                                    {formatAmount(lvl.small_blind)} / {formatAmount(lvl.big_blind)}
                                  </td>
                                  <td style={styles.td}>{formatAmount(lvl.ante)}</td>
                                  <td style={styles.td}>{lvl.duration} min</td>
                                </tr>
                              );
                            }
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right column: Payout Simulator */}
                  <div style={styles.simCol}>
                    <h4 style={styles.sectionTitle}>Simulador de Premios</h4>
                    
                    <div style={styles.simInputsRow}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.85rem' }}>Jugadores</label>
                        <input
                          type="number"
                          data-testid="sim-players-input"
                          className="form-input"
                          style={styles.simInput}
                          value={simPlayers}
                          onChange={handlePlayersChange}
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.85rem' }}>Buy-in (CLP)</label>
                        <input
                          type="number"
                          data-testid="sim-buyin-input"
                          className="form-input"
                          style={styles.simInput}
                          value={simBuyIn}
                          onChange={handleBuyInChange}
                        />
                      </div>
                    </div>

                    <div style={styles.simResults}>
                      <div style={styles.resultItem}>
                        <span>Bolsa Bruta:</span>
                        <strong data-testid="sim-gross-pool">{formatAmount(grossPool)}</strong>
                      </div>
                      <div style={styles.resultItem}>
                        <span>Descuento Rake:</span>
                        <strong data-testid="sim-rake-deduction">{formatAmount(rakeDeduction)}</strong>
                      </div>
                      <div style={styles.resultItem} className="net-pool-row">
                        <span>Bolsa Neta:</span>
                        <strong data-testid="sim-net-pool" style={{ color: '#10b981' }}>{formatAmount(netPool)}</strong>
                      </div>
                    </div>

                    <h5 style={styles.subsectionTitle}>Distribución de Premios</h5>
                    <div style={styles.payoutList}>
                      {prizeRows.map((prize) => (
                        <div 
                          key={prize.position} 
                          data-testid={`prize-row-${prize.position}`}
                          style={styles.prizeRow}
                        >
                          <span style={styles.prizePosition}>#{prize.position} Lugar</span>
                          <span style={styles.prizePercent}>{prize.percentage}%</span>
                          <span style={styles.prizeVal}>{formatAmount(prize.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* LIST VIEW */
              <div style={styles.listContainer}>
                {/* System Presets */}
                <div style={styles.presetSection}>
                  <h4 style={styles.sectionTitle}>Estructuras Predeterminadas</h4>
                  <div style={styles.structureGrid}>
                    {PRESETS.map((struct) => (
                      <div
                        key={struct.id}
                        data-testid={`structure-item-${struct.id}`}
                        onClick={() => handleSelectStructure(struct)}
                        className="glass-panel glass-panel-hover"
                        style={styles.structureCard}
                      >
                        <div style={styles.structureCardHeader}>
                          <h5 style={styles.structureName}>{struct.name}</h5>
                          <span style={styles.structureTag}>Preset</span>
                        </div>
                        <p style={styles.structureMeta}>
                          {Array.isArray(struct.levels) 
                            ? struct.levels.length 
                            : (struct.levels.levels?.length || 0)} niveles/descansos
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Database Public Structures */}
                <div style={styles.dbSection}>
                  <h4 style={styles.sectionTitle}>Estructuras de la Comunidad</h4>
                  {dbLoading ? (
                    <div data-testid="loading-skeleton" style={styles.loadingSkeleton}>
                      Cargando estructuras de la comunidad...
                    </div>
                  ) : dbError ? (
                    <div style={styles.errorAlert}>
                      Error al cargar estructuras: {dbError}
                    </div>
                  ) : dbStructures.length === 0 ? (
                    <div style={styles.emptyState}>
                      No se encontraron estructuras publicadas.
                    </div>
                  ) : (
                    <div style={styles.structureGrid}>
                      {dbStructures.map((struct) => (
                        <div
                          key={struct.id}
                          data-testid={`structure-item-${struct.id}`}
                          onClick={() => handleSelectStructure(struct)}
                          className="glass-panel glass-panel-hover"
                          style={styles.structureCard}
                        >
                          <div style={styles.structureCardHeader}>
                            <h5 style={styles.structureName}>{struct.name}</h5>
                            <span style={{ ...styles.structureTag, backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                              Pública
                            </span>
                          </div>
                          <p style={styles.structureMeta}>
                            {Array.isArray(struct.levels) 
                              ? struct.levels.length 
                              : (struct.levels.levels?.length || 0)} niveles/descansos
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer with credits */}
      <footer style={styles.footer}>
        <p style={styles.footerText}>
          &copy; {new Date().getFullYear()} Poker Director SaaS. Todos los derechos reservados.
        </p>
        <p style={styles.credits}>
          Creada por <strong style={styles.creatorGlow}>Mauricio Lara</strong>
        </p>
      </footer>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '20px 6%',
    position: 'relative',
    zIndex: 1,
    fontFamily: 'Space Grotesk, sans-serif',
    overflow: 'hidden',
  },
  glow1: {
    position: 'absolute',
    top: '5%',
    left: '2%',
    width: '450px',
    height: '450px',
    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
    zIndex: -1,
    pointerEvents: 'none',
  },
  glow2: {
    position: 'absolute',
    bottom: '10%',
    right: '2%',
    width: '550px',
    height: '550px',
    background: 'radial-gradient(circle, rgba(245, 158, 11, 0.06) 0%, transparent 70%)',
    zIndex: -1,
    pointerEvents: 'none',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    zIndex: 10,
    position: 'relative',
  },
  logoWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    height: '46px',
    width: 'auto',
    objectFit: 'contain',
  },
  logoText: {
    fontSize: '1.4rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #ffffff 40%, #c5a880 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.03em',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  adminBtn: {
    padding: '8px 16px',
    fontSize: '0.85rem',
    fontWeight: 700,
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    background: 'rgba(245, 158, 11, 0.02)',
  },
  ligaBtn: {
    padding: '8px 18px',
    fontSize: '0.85rem',
    fontWeight: 600,
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
  },
  whatsappLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#25D366',
    color: '#000000',
    padding: '8px 18px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '0.85rem',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  whatsappIcon: {
    width: '16px',
    height: '16px',
  },
  heroSection: {
    display: 'grid',
    gridTemplateColumns: '1.25fr 1fr',
    gap: '50px',
    alignItems: 'center',
    margin: '40px 0',
    zIndex: 2,
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    alignSelf: 'flex-start',
    padding: '6px 14px',
    borderRadius: '100px',
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    color: '#f59e0b',
    fontSize: '0.8rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
  },
  title: {
    fontSize: '3.6rem',
    fontWeight: 800,
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
    color: '#ffffff',
  },
  titleGradient: {
    background: 'linear-gradient(135deg, #c5a880 10%, #f59e0b 90%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '1.1rem',
    lineHeight: 1.6,
    color: 'var(--color-text-secondary)',
    maxWidth: '560px',
  },
  mockupContainer: {
    position: 'relative',
    marginTop: '20px',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid rgba(197, 168, 128, 0.15)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
  },
  mockupImage: {
    width: '100%',
    height: 'auto',
    display: 'block',
    objectFit: 'cover',
  },
  mockupGlow: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to top, rgba(6, 9, 19, 0.6) 0%, transparent 100%)',
    pointerEvents: 'none',
  },
  rightColumn: {
    display: 'flex',
    justifyContent: 'center',
  },
  featuresCard: {
    width: '100%',
    maxWidth: '430px',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
    border: '1px solid rgba(197, 168, 128, 0.12)',
    background: 'rgba(15, 23, 42, 0.45)',
  },
  featuresCardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  featuresCardTitle: {
    fontSize: '1.7rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  featuresCardSubtitle: {
    fontSize: '0.88rem',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.4,
  },
  featuresList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  featureItem: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
  },
  iconWrapper: {
    padding: '10px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: '4px',
  },
  featureDesc: {
    fontSize: '0.82rem',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.4,
  },
  startBtn: {
    width: '100%',
    padding: '14px',
    fontWeight: 750,
    background: 'linear-gradient(135deg, #c5a880 0%, #f59e0b 100%)',
    border: 'none',
    color: '#000000',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modalContent: {
    maxWidth: '460px',
    width: '100%',
    padding: '40px',
    border: '1px solid rgba(197, 168, 128, 0.2)',
    background: '#0a0f1d',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    position: 'relative',
  },
  modalCloseX: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'none',
    border: 'none',
    fontSize: '1.8rem',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
  },
  modalTabs: {
    display: 'flex',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    paddingBottom: '8px',
    gap: '16px',
  },
  modalTabBtn: {
    background: 'none',
    border: 'none',
    padding: '8px 4px',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#ffffff',
    margin: 0,
  },
  modalSubtitle: {
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.45,
    margin: 0,
  },
  modalCodeInput: {
    textAlign: 'center',
    fontSize: '1.3rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: 'rgba(245, 158, 11, 0.01)',
    color: '#ffffff',
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #c5a880 0%, #f59e0b 100%)',
    border: 'none',
    color: '#000000',
    marginTop: '10px',
  },
  passwordToggle: {
    position: 'absolute',
    top: '50%',
    right: '12px',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
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
  successAlert: {
    padding: '12px 16px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '8px',
    color: '#10b981',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  footer: {
    marginTop: '60px',
    padding: '25px 0',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
    flexWrap: 'wrap',
    gap: '16px',
    zIndex: 10,
    position: 'relative',
  },
  footerText: {
    margin: 0,
  },
  credits: {
    margin: 0,
    fontSize: '0.9rem',
  },
  creatorGlow: {
    color: '#c5a880',
    fontWeight: 700,
    textShadow: '0 0 8px rgba(197, 168, 128, 0.3)',
  },
  explorarBtn: {
    padding: '8px 16px',
    fontSize: '0.85rem',
    fontWeight: 700,
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    background: 'rgba(16, 185, 129, 0.02)',
  },
  modalExplorerOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modalExplorerContent: {
    maxWidth: '900px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    border: '1px solid rgba(197, 168, 128, 0.2)',
    background: '#0a0f1d',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    position: 'relative',
    padding: '30px',
    borderRadius: '16px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
  },
  modalExplorerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '12px',
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  presetSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  dbSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#ffffff',
    margin: 0,
  },
  subsectionTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#ffffff',
    margin: '16px 0 8px 0',
  },
  structureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '16px',
  },
  structureCard: {
    padding: '16px',
    cursor: 'pointer',
    background: 'rgba(15, 23, 42, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  structureCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  structureName: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#ffffff',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '160px',
  },
  structureTag: {
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '100px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    color: '#10b981',
  },
  structureMeta: {
    fontSize: '0.8rem',
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  loadingSkeleton: {
    padding: '20px',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
  },
  emptyState: {
    padding: '20px',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
    border: '1px dashed rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
  },
  detailContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  backBtn: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    color: '#10b981',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  detailGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '24px',
  },
  levelsCol: {
    flex: '1 1 350px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  levelsContainer: {
    maxHeight: '400px',
    overflowY: 'auto',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    background: 'rgba(15, 23, 42, 0.2)',
  },
  levelsTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.9rem',
  },
  th: {
    position: 'sticky',
    top: 0,
    background: '#0a0f1d',
    padding: '10px 12px',
    textAlign: 'left',
    color: 'var(--color-text-secondary)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    fontWeight: 600,
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },
  levelRow: {
    transition: 'background 0.2s',
  },
  breakRow: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  breakCell: {
    padding: '10px 12px',
    color: '#10b981',
    fontWeight: 700,
    textAlign: 'center',
    borderBottom: '1px solid rgba(16, 185, 129, 0.15)',
  },
  simCol: {
    flex: '1 1 350px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    background: 'rgba(15, 23, 42, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    padding: '16px',
  },
  simInputsRow: {
    display: 'flex',
    gap: '16px',
  },
  simInput: {
    width: '100%',
    padding: '10px',
    background: 'rgba(15, 23, 42, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    color: '#ffffff',
  },
  simResults: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: 'rgba(15, 23, 42, 0.4)',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.04)',
  },
  resultItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.9rem',
    color: 'var(--color-text-secondary)',
  },
  payoutList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  prizeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '6px',
    fontSize: '0.9rem',
  },
  prizePosition: {
    fontWeight: 600,
    color: '#ffffff',
  },
  prizePercent: {
    color: 'var(--color-text-secondary)',
  },
  prizeVal: {
    fontWeight: 700,
    color: '#f59e0b',
  },
};
