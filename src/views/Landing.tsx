import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Tv, Users, Landmark, ChevronRight, Award, Zap } from 'lucide-react';

export const Landing: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error: err } = await signIn(email, password);
        if (err) setError(err.message || 'Error al iniciar sesión');
      } else {
        if (!name.trim()) {
          setError('El nombre es requerido');
          setLoading(false);
          return;
        }
        const { error: err } = await signUp(email, password, name);
        if (err) setError(err.message || 'Error al registrarse');
      }
    } catch (err) {
      setError('Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Background glow effects */}
      <div style={styles.glow1}></div>
      <div style={styles.glow2}></div>

      {/* Main Grid: Left copy, Right login/signup */}
      <div style={styles.heroSection}>
        <div style={styles.leftColumn}>
          <div style={styles.badge}>
            <Zap size={14} color="#10b981" />
            <span>PLATAFORMA PÓKER SAAS PROFESIONAL</span>
          </div>
          <h1 style={styles.title}>
            Lleva tus Torneos de <br />
            <span style={styles.titleGradient}>Póker al Siguiente Nivel</span>
          </h1>
          <p style={styles.subtitle}>
            Administra partidas de una o múltiples mesas de forma sencilla. Sorteo de asientos, balanceo de mesas automatizado, reloj de ciegas dinámico y visualización en TV con anuncios por voz.
          </p>

          {/* Features Grid */}
          <div style={styles.featuresGrid}>
            <div className="glass-panel" style={styles.featureCard}>
              <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--color-primary-glow)' }}>
                <Tv size={20} color="var(--color-primary)" />
              </div>
              <div>
                <h3 style={styles.featureTitle}>Reloj de TV Profesional</h3>
                <p style={styles.featureDesc}>Pantalla completa optimizada para proyectores y televisores con voz inteligente.</p>
              </div>
            </div>

            <div className="glass-panel" style={styles.featureCard}>
              <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--color-accent-glow)' }}>
                <Users size={20} color="var(--color-accent)" />
              </div>
              <div>
                <h3 style={styles.featureTitle}>Balanceo Automático</h3>
                <p style={styles.featureDesc}>Algoritmo inteligente para organizar mesas, asientos y transferencias de jugadores.</p>
              </div>
            </div>

            <div className="glass-panel" style={styles.featureCard}>
              <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--color-secondary-glow)' }}>
                <Landmark size={20} color="var(--color-secondary)" />
              </div>
              <div>
                <h3 style={styles.featureTitle}>Control de Recompras</h3>
                <p style={styles.featureDesc}>Registra recompras (rebuys), adiciones (add-ons) y calcula premios al instante.</p>
              </div>
            </div>

            <div className="glass-panel" style={styles.featureCard}>
              <div style={{ ...styles.iconWrapper, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                <Award size={20} color="#ef4444" />
              </div>
              <div>
                <h3 style={styles.featureTitle}>Ligas e Historial</h3>
                <p style={styles.featureDesc}>Guarda el historial de partidas, posiciones finales y tabla general de líderes.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: login / register */}
        <div style={styles.rightColumn}>
          <div className="glass-panel" style={styles.loginCard}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
              <p style={styles.cardSubtitle}>
                {isLogin ? 'Ingresa para gestionar tus torneos' : 'Regístrate como organizador hoy'}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              {error && <div style={styles.errorAlert}>{error}</div>}

              {!isLogin && (
                <div className="form-group">
                  <label className="form-label">Nombre del Organizador</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej. Casino Club"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
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
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
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
              <span>{isLogin ? '¿No tienes una cuenta?' : '¿Ya tienes una cuenta?'}</span>
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
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

      {/* Footer */}
      <footer style={styles.footer}>
        <p>&copy; {new Date().getFullYear()} Poker Director SaaS - Administrador de Torneos Profesional.</p>
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
    padding: '40px 8%',
    position: 'relative',
    zIndex: 1,
  },
  glow1: {
    position: 'absolute',
    top: '10%',
    left: '5%',
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
    zIndex: -1,
    pointerEvents: 'none',
  },
  glow2: {
    position: 'absolute',
    bottom: '15%',
    right: '5%',
    width: '500px',
    height: '500px',
    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)',
    zIndex: -1,
    pointerEvents: 'none',
  },
  heroSection: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '60px',
    alignItems: 'center',
    marginTop: '40px',
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
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    color: '#10b981',
    fontSize: '0.8rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
  },
  title: {
    fontSize: '3.5rem',
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  titleGradient: {
    background: 'linear-gradient(135deg, #10b981 30%, #6366f1 90%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '1.15rem',
    lineHeight: 1.6,
    color: 'var(--color-text-secondary)',
    maxWidth: '580px',
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginTop: '20px',
  },
  featureCard: {
    padding: '20px',
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
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
    fontSize: '1.05rem',
    fontWeight: 700,
    marginBottom: '6px',
    color: 'var(--color-text-primary)',
  },
  featureDesc: {
    fontSize: '0.85rem',
    lineHeight: 1.4,
    color: 'var(--color-text-muted)',
  },
  rightColumn: {
    display: 'flex',
    justifyContent: 'center',
  },
  loginCard: {
    width: '100%',
    maxWidth: '450px',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    borderWidth: '1px',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardTitle: {
    fontSize: '1.8rem',
    fontWeight: 700,
  },
  cardSubtitle: {
    fontSize: '0.9rem',
    color: 'var(--color-text-secondary)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    marginTop: '10px',
  },
  errorAlert: {
    padding: '12px 16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '0.9rem',
    fontWeight: 500,
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-primary)',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  footer: {
    marginTop: '60px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    textAlign: 'center',
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
  },
};
