import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Zap, Key, Eye, EyeOff, Shield, Tv, Users, Landmark, Award, ArrowRight, LogIn } from 'lucide-react';
import logoImg from '../assets/logo.png';
import landingImg from '../assets/landing.png';

export const Landing: React.FC = () => {
  const { signIn, signUp } = useAuth();
  
  // Modal states for "Acceso a tu liga"
  const [showLeagueModal, setShowLeagueModal] = useState(false);
  const [modalTab, setModalTab] = useState<'code' | 'login'>('code'); // 'code' for Register, 'login' for Login
  
  // Registration form states
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCode, setRegCode] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Login form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  // Super Admin modal states
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

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

  // Handle Client Registration with code
  const handleRegisterWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');
    setRegLoading(true);

    if (!regName.trim()) {
      setRegError('El nombre del organizador es requerido');
      setRegLoading(false);
      return;
    }
    if (!regCode.trim()) {
      setRegError('Se requiere un Código de Liga válido.');
      setRegLoading(false);
      return;
    }

    try {
      const { error: err } = await signUp(regEmail, regPassword, regName, regCode);
      if (err) {
        setRegError(err.message || 'Error al registrarse. Revisa tu código o datos.');
      } else {
        setRegSuccess('¡Cuenta de organizador creada con éxito! Redirigiendo...');
        setTimeout(() => {
          setShowLeagueModal(false);
          setRegSuccess('');
        }, 1500);
      }
    } catch (err) {
      setRegError('Ocurrió un error inesperado');
    } finally {
      setRegLoading(false);
    }
  };

  // Handle Client Login
  const handleClientLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const { error: err } = await signIn(loginEmail, loginPassword);
      if (err) {
        setLoginError(err.message || 'Credenciales incorrectas.');
      } else {
        setShowLeagueModal(false);
      }
    } catch (err) {
      setLoginError('Ocurrió un error inesperado');
    } finally {
      setLoginLoading(false);
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
      <header style={styles.header}>
        <div style={styles.logoWrapper}>
          <img src={logoImg} alt="Logo" style={styles.logo} />
          <span style={styles.logoText}>Poker Director</span>
        </div>
        <div style={styles.headerActions}>
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
          
          <a 
            href="https://wa.me/56993005959" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={styles.whatsappLink}
          >
            <svg style={styles.whatsappIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.386 9.807-9.78.002-2.613-1.013-5.074-2.86-6.92C16.315 2.059 13.859 1.042 11.25 1.042c-5.41 0-9.81 4.387-9.814 9.78-.002 1.704.447 3.37 1.287 4.853L1.68 20.306l4.967-1.152zM17.487 14.39c-.314-.157-1.857-.915-2.147-1.02-.29-.105-.5-.157-.712.157-.21.314-.818 1.02-.818 1.02-.21.262-.42.315-.733.157-1.637-.629-2.92-1.258-4.084-3.26-.31-.53.31-.49.886-.98.156-.156.262-.262.366-.418.105-.157.052-.314-.026-.47-.079-.158-.713-1.716-.977-2.35-.262-.629-.533-.53-.733-.54-.2-.01-.42-.015-.63-.015s-.556.079-.846.398c-.29.314-1.11 1.085-1.11 2.646s1.14 3.072 1.298 3.282c.157.21 2.23 3.407 5.4 4.773 1.157.498 2.062.8 2.766 1.023.754.238 1.44.204 1.98.123.6-.09 1.857-.76 2.12-1.493.262-.733.262-1.36.183-1.493-.079-.131-.29-.21-.603-.367z" />
            </svg>
            Contáctame
          </a>
        </div>
      </header>

      {/* Main Grid: Left copy & showcase image, Right Features Showcase */}
      <div style={styles.heroSection}>
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
            Administra partidas de una o múltiples mesas de forma profesional. Sorteo de asientos, balanceo automático, reloj de ciegas dinámico y proyección completa para TV con voz inteligente.
          </p>

          {/* Optimized Interface Mockup */}
          <div style={styles.mockupContainer}>
            <img src={landingImg} alt="Poker App Interface" style={styles.mockupImage} />
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
                  <h4 style={styles.featureTitle}>Reloj de Ciegas en TV</h4>
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
                setModalTab('code');
                setShowLeagueModal(true);
              }}
            >
              Comenzar ahora
              <ArrowRight size={18} style={{ marginLeft: '6px' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Acceso a tu liga Modal (Tabs for register code vs login) */}
      {showLeagueModal && (
        <div style={styles.modalOverlay}>
          <div className="glass-panel" style={styles.modalContent}>
            {/* Modal Close Button */}
            <button 
              type="button" 
              onClick={() => {
                setShowLeagueModal(false);
                setRegError('');
                setRegSuccess('');
                setLoginError('');
              }}
              style={styles.modalCloseX}
            >
              &times;
            </button>

            {/* Modal Tabs */}
            <div style={styles.modalTabs}>
              <button 
                style={{
                  ...styles.modalTabBtn,
                  borderBottom: modalTab === 'code' ? '2px solid #f59e0b' : 'none',
                  color: modalTab === 'code' ? '#ffffff' : 'var(--color-text-muted)',
                }}
                onClick={() => setModalTab('code')}
              >
                <Key size={16} style={{ marginRight: '6px' }} />
                Registrarse con Código
              </button>
              <button 
                style={{
                  ...styles.modalTabBtn,
                  borderBottom: modalTab === 'login' ? '2px solid #f59e0b' : 'none',
                  color: modalTab === 'login' ? '#ffffff' : 'var(--color-text-muted)',
                }}
                onClick={() => setModalTab('login')}
              >
                <LogIn size={16} style={{ marginRight: '6px' }} />
                Iniciar Sesión
              </button>
            </div>

            {/* TAB: Register with Code */}
            {modalTab === 'code' && (
              <form onSubmit={handleRegisterWithCode} style={styles.modalForm}>
                <h3 style={styles.modalTitle}>Acceso con Código</h3>
                <p style={styles.modalSubtitle}>Crea tu cuenta de organizador ingresando el código único provisto por el Super Administrador.</p>
                
                {regError && <div style={styles.errorAlert}>{regError}</div>}
                {regSuccess && <div style={styles.successAlert}>{regSuccess}</div>}
                
                <div className="form-group">
                  <label className="form-label">Código de Liga / Invitación</label>
                  <input
                    type="text"
                    className="form-input"
                    style={styles.modalCodeInput}
                    placeholder="LIGA-XXXXXX"
                    value={regCode}
                    onChange={(e) => setRegCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre del Organizador</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej. Club de Póker Lara"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Correo Electrónico</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="correo@servidor.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="••••••••"
                      style={{ paddingRight: '40px' }}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      style={styles.passwordToggle}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={styles.submitBtn}
                  disabled={regLoading}
                >
                  {regLoading ? 'Registrando...' : 'Registrar Cuenta de Liga'}
                </button>
              </form>
            )}

            {/* TAB: Standard Login */}
            {modalTab === 'login' && (
              <form onSubmit={handleClientLogin} style={styles.modalForm}>
                <h3 style={styles.modalTitle}>Iniciar Sesión</h3>
                <p style={styles.modalSubtitle}>Ingresa tus credenciales de organizador para administrar tus torneos en curso.</p>
                
                {loginError && <div style={styles.errorAlert}>{loginError}</div>}
                
                <div className="form-group">
                  <label className="form-label">Correo Electrónico</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="organizador@poker.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="••••••••"
                      style={{ paddingRight: '40px' }}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      style={styles.passwordToggle}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={styles.submitBtn}
                  disabled={loginLoading}
                >
                  {loginLoading ? 'Ingresando...' : 'Iniciar Sesión'}
                </button>
              </form>
            )}
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
};
