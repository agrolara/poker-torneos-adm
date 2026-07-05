import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Landing } from './views/Landing';
import { Dashboard } from './views/Dashboard';
import { Players } from './views/Players';
import { Structures } from './views/Structures';
import { TournamentSetup } from './views/TournamentSetup';
import { TournamentControl } from './views/TournamentControl';
import { TVDisplay } from './views/TVDisplay';
import type { Tournament } from './types';

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
    <div style={styles.appLayout}>
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
};
