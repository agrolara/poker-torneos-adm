import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Trophy, Users, Clock, Home, Award } from 'lucide-react';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
  const { user, profile, signOut } = useAuth();

  return (
    <header className="glass-panel" style={styles.header}>
      {/* Brand logo */}
      <div style={styles.brand} onClick={() => onNavigate('dashboard')}>
        <Trophy size={24} color="var(--color-primary)" />
        <span style={styles.logoText}>Poker SaaS</span>
      </div>

      {/* Nav Links */}
      <nav style={styles.nav}>
        <button 
          style={{ ...styles.navLink, color: currentView === 'dashboard' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
          onClick={() => onNavigate('dashboard')}
        >
          <Home size={16} /> Panel
        </button>
        <button 
          style={{ ...styles.navLink, color: currentView === 'championships' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
          onClick={() => onNavigate('championships')}
        >
          <Award size={16} /> Campeonatos
        </button>
        <button 
          style={{ ...styles.navLink, color: currentView === 'players' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
          onClick={() => onNavigate('players')}
        >
          <Users size={16} /> Jugadores
        </button>
        <button 
          style={{ ...styles.navLink, color: currentView === 'structures' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
          onClick={() => onNavigate('structures')}
        >
          <Clock size={16} /> Ciegas
        </button>
      </nav>

      {/* Right User info and signout */}
      <div style={styles.userSection}>
        <span style={styles.welcomeText}>
          {user?.email?.startsWith('liga-') ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
              <span>
                Liga: <strong style={styles.orgName}>{profile?.name || 'Liga'}</strong>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
              <span>
                Código: <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.85rem' }}>{user.email.split('@')[0].toUpperCase()}</strong>
              </span>
            </span>
          ) : (
            <>
              {user?.email === 'materiales.integrity@gmail.com' ? 'Super Administrador' : 'Organizador'}: <strong style={styles.orgName}>{profile?.name || (user?.email === 'materiales.integrity@gmail.com' ? 'Mauricio Lara' : user?.email) || 'Cargando...'}</strong>
            </>
          )}
        </span>
        <button className="btn btn-outline" style={styles.logoutBtn} onClick={signOut} title="Cerrar Sesión">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    padding: '16px 30px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 'var(--radius-md)',
    marginBottom: '20px',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
  },
  logoText: {
    fontSize: '1.25rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    background: 'linear-gradient(135deg, #10b981 0%, #6366f1 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  nav: {
    display: 'flex',
    gap: '24px',
  },
  navLink: {
    background: 'none',
    border: 'none',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'color 0.2s ease',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  welcomeText: {
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
  },
  orgName: {
    color: 'var(--color-text-primary)',
    fontWeight: 650,
  },
  logoutBtn: {
    padding: '8px',
    borderRadius: '8px',
  },
};
