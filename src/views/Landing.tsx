import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { ChevronRight, Zap, Key, Eye, EyeOff } from 'lucide-react';
import logoImg from '../assets/logo.png';
import landingImg from '../assets/landing.png';

export const Landing: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [leagueCode, setLeagueCode] = useState('');
  
  // Modal states for "Acceso a tu liga"
  const [showLeagueModal, setShowLeagueModal] = useState(false);
  const [modalCode, setModalCode] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error: err } = await signIn(email, password);
        if (err) setError(err.message || 'Error al iniciar sesión. Verifica tus datos.');
      } else {
        if (!name.trim()) {
          setError('El nombre del organizador es requerido');
          setLoading(false);
          return;
        }
        if (!leagueCode.trim()) {
          setError('Se requiere un Código de Liga para registrarse.');
          setLoading(false);
          return;
        }
        const { error: err } = await signUp(email, password, name, leagueCode);
        if (err) setError(err.message || 'Error al registrarse.');
      }
    } catch (err) {
      setError('Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyModalCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');
    setVerifyingCode(true);

    if (!modalCode.trim()) {
      setModalError('Por favor ingresa un código.');
      setVerifyingCode(false);
      return;
    }

    try {
      const { data, error: queryErr } = await supabase
        .from('league_codes')
        .select('*')
        .eq('code', modalCode.trim().toUpperCase())
        .is('used_by', null)
        .single();

      if (queryErr || !data) {
        setModalError('Código no válido, expirado o ya utilizado.');
      } else {
        setModalSuccess('¡Código verificado con éxito! Redirigiendo...');
        setLeagueCode(modalCode.trim().toUpperCase());
        setTimeout(() => {
          setIsLogin(false); // Switch to registration form
          setShowLeagueModal(false);
          setModalSuccess('');
          setModalCode('');
        }, 1500);
      }
    } catch (err) {
      setModalError('Error al conectar con el servidor.');
    } finally {
      setVerifyingCode(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Background glow effects */}
      <div style={styles.glow1}></div>
      <div style={styles.glow2}></div>

      {/* Header section with Logo & WhatsApp link */}
      <header style={styles.header}>
        <div style={styles.logoWrapper}>
          <img src={logoImg} alt="Logo" style={styles.logo} />
          <span style={styles.logoText}>Poker Director</span>
        </div>
        <div style={styles.headerActions}>
          <button 
            className="btn btn-outline" 
            style={styles.ligaBtn}
            onClick={() => setShowLeagueModal(true)}
          >
            <Key size={16} style={{ marginRight: '6px' }} />
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

      {/* Main Grid: Left copy & image, Right form */}
      <div style={styles.heroSection}>
        <div style={styles.leftColumn}>
          <div style={styles.badge}>
            <Zap size={14} color="#f59e0b" />
            <span>ACCESO EXCLUSIVO A LIGAS</span>
          </div>
          <h1 style={styles.title}>
            Lleva tus Torneos al <br />
            <span style={styles.titleGradient}>Siguiente Nivel</span>
          </h1>
          
          <p style={styles.subtitle}>
            Administra partidas de una o múltiples mesas de forma profesional. Sorteo de asientos, balanceo automático, reloj de ciegas dinámico y proyección completa para TV con voz inteligente.
          </p>

          {/* User Image Mockup */}
          <div style={styles.mockupContainer}>
            <img src={landingImg} alt="Poker App Interface" style={styles.mockupImage} />
            <div style={styles.mockupGlow}></div>
          </div>
        </div>

        {/* Right column: login / register */}
        <div style={styles.rightColumn}>
          <div className="glass-panel" style={styles.loginCard}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
              <p style={styles.cardSubtitle}>
                {isLogin ? 'Ingresa para gestionar tus torneos' : 'Registra tu club y empieza a jugar'}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              {error && <div style={styles.errorAlert}>{error}</div>}

              {!isLogin && (
                <>
                  <div className="form-group">
                    <label className="form-label">Nombre del Organizador</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej. Club de Póker Lara"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Código de Liga / Invitación</label>
                    <input
                      type="text"
                      className="form-input"
                      style={styles.codeHighlight}
                      placeholder="Ej. LIGA-XXXXXX"
                      value={leagueCode}
                      onChange={(e) => setLeagueCode(e.target.value.toUpperCase())}
                      required
                    />
                    <small style={styles.inputHelp}>
                      Se requiere un código exclusivo generado por el administrador para registrarse.
                    </small>
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="organizador@poker.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                disabled={loading}
              >
                {loading ? 'Procesando...' : isLogin ? 'Ingresar a la Plataforma' : 'Registrar Cuenta'}
                <ChevronRight size={18} />
              </button>
            </form>

            <div style={styles.cardFooter}>
              <span>{isLogin ? '¿Tienes un código de liga?' : '¿Ya tienes una cuenta?'}</span>
              <button
                onClick={() => {
                  if (isLogin) {
                    setIsLogin(false);
                  } else {
                    setIsLogin(true);
                  }
                  setError('');
                }}
                style={styles.toggleBtn}
              >
                {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Code validation modal */}
      {showLeagueModal && (
        <div style={styles.modalOverlay}>
          <div className="glass-panel" style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Acceso a tu Liga</h3>
              <p style={styles.modalSubtitle}>Ingresa el código exclusivo para activar tu cuenta de organizador.</p>
            </div>
            
            <form onSubmit={handleVerifyModalCode} style={styles.modalForm}>
              {modalError && <div style={styles.errorAlert}>{modalError}</div>}
              {modalSuccess && <div style={styles.successAlert}>{modalSuccess}</div>}
              
              <div className="form-group">
                <label className="form-label">Código Único de Liga</label>
                <input
                  type="text"
                  className="form-input"
                  style={styles.modalInput}
                  placeholder="LIGA-XXXXXX"
                  value={modalCode}
                  onChange={(e) => setModalCode(e.target.value.toUpperCase())}
                  autoFocus
                  required
                />
              </div>

              <div style={styles.modalActions}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => {
                    setShowLeagueModal(false);
                    setModalError('');
                    setModalSuccess('');
                  }}
                  disabled={verifyingCode}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={verifyingCode}
                >
                  {verifyingCode ? 'Verificando...' : 'Verificar e Ingresar'}
                </button>
              </div>
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
  loginCard: {
    width: '100%',
    maxWidth: '430px',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    border: '1px solid rgba(197, 168, 128, 0.12)',
    background: 'rgba(15, 23, 42, 0.45)',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardTitle: {
    fontSize: '1.7rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  cardSubtitle: {
    fontSize: '0.88rem',
    color: 'var(--color-text-secondary)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  codeHighlight: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: 'rgba(245, 158, 11, 0.02)',
    fontWeight: 700,
    letterSpacing: '0.05em',
  },
  inputHelp: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    marginTop: '4px',
    display: 'block',
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    marginTop: '10px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #c5a880 0%, #f59e0b 100%)',
    border: 'none',
    color: '#000000',
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
  cardFooter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: '#f59e0b',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'underline',
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
    maxWidth: '450px',
    width: '100%',
    padding: '35px',
    border: '1px solid rgba(197, 168, 128, 0.2)',
    background: '#0a0f1d',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  modalHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  modalTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.4,
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalInput: {
    textAlign: 'center',
    fontSize: '1.3rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    borderColor: 'rgba(197, 168, 128, 0.3)',
    color: '#ffffff',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '10px',
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
