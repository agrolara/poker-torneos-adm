import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Landing } from './views/Landing';
import { Dashboard } from './views/Dashboard';
import { Players } from './views/Players';
import { Structures } from './views/Structures';
import { Championships } from './views/Championships';
import { TournamentSetup } from './views/TournamentSetup';
import { TournamentControl } from './views/TournamentControl';
import { TVDisplay } from './views/TVDisplay';
import type { Tournament } from './types';
import { isConfigured } from './supabaseClient';

// App content wrapper to use useAuth hook
const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [view, setView] = useState<string>('dashboard');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [isTVMode, setIsTVMode] = useState(false);

  useEffect(() => {
    // Check if the URL has ?tv=true to open display mode directly
    if (window.location.search.includes('tv=true')) {
      setIsTVMode(true);
    }
  }, []);

  if (isTVMode) {
    return <TVDisplay />;
  }

  // If Supabase is not configured, show a helpful setup screen
  if (!isConfigured) {
    return (
      <div style={styles.errorScreen}>
        <div className="glass-panel" style={styles.errorCard}>
          <h2 style={styles.errorTitle}>⚠️ Configuración Pendiente</h2>
          <p style={styles.errorText}>
            No se han detectado las variables de entorno de conexión en el servidor.
          </p>
          <div style={styles.errorInstructions}>
            <p style={{ marginBottom: '10px' }}><strong>Sigue estos pasos en tu panel de Coolify para solucionarlo:</strong></p>
            <ol style={styles.ol}>
              <li>Ve a la pestaña <strong>Environment Variables</strong> (en el menú izquierdo de tu app en Coolify).</li>
              <li>Añade <strong>VITE_SUPABASE_URL</strong> y <strong>VITE_SUPABASE_ANON_KEY</strong> con sus respectivos valores.</li>
              <li>Asegúrate de marcar la casilla <strong>"Build time"</strong> para ambas variables.</li>
              <li>Haz clic en el botón de <strong>Deploy</strong> (arriba a la derecha) para reconstruir la app.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: '20px', color: 'var(--color-text-secondary)' }}>
          Cargando Poker SaaS...
        </p>
      </div>
    );
  }

  // Not logged in -> Show beautiful Landing / Register view
  if (!user) {
    return <Landing />;
  }

  // Logged in -> Show Header and state-based page views
  const handleNavigate = (targetView: string, data?: any) => {
    if (targetView === 'control' && data) {
      setSelectedTournament(data);
    }
    setView(targetView);
  };

  return (
    <div className="app-layout" style={styles.appLayout}>
      <div className="app-watermark"></div>
      <Header currentView={view} onNavigate={handleNavigate} />
      
      <main style={styles.mainContent}>
        {view === 'dashboard' && (
          <Dashboard onNavigate={handleNavigate} />
        )}
        
        {view === 'players' && (
          <Players onBack={() => setView('dashboard')} />
        )}
        
        {view === 'structures' && (
          <Structures onBack={() => setView('dashboard')} />
        )}
        
        {view === 'championships' && (
          <Championships onNavigate={handleNavigate} />
        )}
        
        {view === 'setup' && (
          <TournamentSetup 
            onBack={() => setView('dashboard')} 
            onNavigate={handleNavigate} 
          />
        )}
        
        {view === 'control' && selectedTournament && (
          <TournamentControl 
            tournament={selectedTournament} 
            onBack={() => setView('dashboard')} 
          />
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loadingScreen: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#05070e',
    fontFamily: 'Outfit, sans-serif',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255, 255, 255, 0.05)',
    borderTopColor: 'var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  appLayout: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 4%',
    maxWidth: '1440px',
    margin: '0 auto',
  },
  mainContent: {
    flexGrow: 1,
  },
  errorScreen: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    backgroundColor: '#060913',
    fontFamily: 'Outfit, sans-serif',
  },
  errorCard: {
    maxWidth: '550px',
    width: '100%',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    border: '1px solid rgba(239, 68, 68, 0.2)',
  },
  errorTitle: {
    fontSize: '1.6rem',
    color: '#ef4444',
    fontWeight: 700,
  },
  errorText: {
    fontSize: '1rem',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
  },
  errorInstructions: {
    fontSize: '0.9rem',
    color: 'var(--color-text-secondary)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.03)',
  },
  ol: {
    paddingLeft: '20px',
    lineHeight: 1.8,
  },
};
