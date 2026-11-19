import type React from 'react';

// Tokens de color del centro de control. Cada tema define todos los tokens;
// los estilos usan var(--tc-*) para que cambiar de tema no requiera re-render de estilos.
export type ThemeTokens = {
  bg: string; panel: string; raised: string; border: string; borderStrong: string;
  text: string; soft: string; muted: string;
  green: string; greenDark: string; gold: string; amber: string; danger: string;
  // Color de acción: botón de iniciar, barra de progreso y botones principales
  accent: string; accentStrong: string; onAccentBtn: string;
  clockBg: string; clockBorderRun: string; runningText: string; timerWarn: string;
  rowLine: string; avatarBg: string; avatarText: string;
  onAccent: string; onGreen: string; dangerBorder: string; link: string;
  // Mesa
  rail: string; felt: string; feltLine: string; feltText: string; feltSub: string;
};

export type ThemeId = 'medianoche' | 'club' | 'tv';

export interface ControlTheme {
  id: ThemeId;
  name: string;
  description: string;
  tokens: ThemeTokens;
}

export const THEMES: ControlTheme[] = [
  {
    id: 'medianoche',
    name: 'Medianoche',
    description: 'El de siempre: azul noche con paño verde clásico.',
    tokens: {
      bg: '#0A0F1C', panel: '#111827', raised: '#1A2236', border: '#1F2A40', borderStrong: '#2A3550',
      text: '#E8ECF4', soft: '#A9B2C6', muted: '#8A94A8',
      green: '#34D399', greenDark: '#10B981', gold: '#FCD34D', amber: '#F59E0B', danger: '#FCA5A5',
      accent: '#34D399', accentStrong: '#10B981', onAccentBtn: '#062B1F',
      clockBg: '#0E1626', clockBorderRun: '#1F6B52', runningText: '#6EE7B7', timerWarn: '#FCA5A5',
      rowLine: '#172036', avatarBg: '#1E3A34', avatarText: '#6EE7B7',
      onAccent: '#111827', onGreen: '#062B1F', dangerBorder: '#4A2530', link: '#34D399',
      rail: '#1C2638', felt: '#0F3B2E', feltLine: '#1F6B52', feltText: '#CFF5E5', feltSub: '#8FD9BC',
    },
  },
  {
    id: 'club',
    name: 'Club privado',
    description: 'Madera de nogal, paño burdeos y detalles en bronce.',
    tokens: {
      bg: '#130F0C', panel: '#1C1612', raised: '#2A211B', border: '#33281F', borderStrong: '#4A3A2C',
      text: '#F4ECE1', soft: '#CDBDA9', muted: '#A08E79',
      green: '#8CCFA6', greenDark: '#6DB88B', gold: '#E9C47E', amber: '#D9A44E', danger: '#F2A79D',
      accent: '#DDB76C', accentStrong: '#C99A48', onAccentBtn: '#1A1208',
      clockBg: '#181210', clockBorderRun: '#7A5A33', runningText: '#E9C47E', timerWarn: '#F2A79D',
      rowLine: '#2A211B', avatarBg: '#3A2A1F', avatarText: '#E9C47E',
      onAccent: '#1A1208', onGreen: '#0E2418', dangerBorder: '#5C2B26', link: '#E9C47E',
      rail: '#3D2616', felt: '#5C1323', feltLine: '#8C2E40', feltText: '#F7E0DB', feltSub: '#DCA6AC',
    },
  },
  {
    id: 'tv',
    name: 'Torneo TV',
    description: 'Grafito, paño azul torneo y cifras en celeste hielo.',
    tokens: {
      bg: '#0B0D10', panel: '#14171C', raised: '#1D2128', border: '#262B33', borderStrong: '#363D48',
      text: '#F2F5F8', soft: '#AFB7C3', muted: '#87909D',
      green: '#3DDC97', greenDark: '#22C47E', gold: '#8BD8FF', amber: '#FFB547', danger: '#FF9E9E',
      accent: '#4CC3FF', accentStrong: '#22A8F0', onAccentBtn: '#04131F',
      clockBg: '#0F1216', clockBorderRun: '#1E6E9C', runningText: '#8BD8FF', timerWarn: '#FF9E9E',
      rowLine: '#1D2128', avatarBg: '#10324A', avatarText: '#8BD8FF',
      onAccent: '#0B0D10', onGreen: '#052615', dangerBorder: '#4A2228', link: '#8BD8FF',
      rail: '#06070A', felt: '#0E4A7E', feltLine: '#2D6EA6', feltText: '#E4F2FF', feltSub: '#9DC7EE',
    },
  },
];

export const getTheme = (id: string | undefined): ControlTheme =>
  THEMES.find(t => t.id === id) || THEMES[0];

const toVarName = (key: string) => `--tc-${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}`;

// Referencias a variables CSS: C.felt => 'var(--tc-felt)'
export const C = Object.fromEntries(
  Object.keys(THEMES[0].tokens).map(k => [k, `var(${toVarName(k)})`])
) as Record<keyof ThemeTokens, string>;

// Estilo para el contenedor raíz: define las variables del tema elegido
export const themeVars = (theme: ControlTheme): React.CSSProperties =>
  Object.fromEntries(
    Object.entries(theme.tokens).map(([k, v]) => [toVarName(k), v])
  ) as React.CSSProperties;

// Preferencias visuales guardadas en este dispositivo (tablet)
export interface UiPrefs {
  theme: ThemeId;
  timerScale: number;  // 0.8 – 2.0
  blindsScale: number; // 0.8 – 2.0
  layout: 'centrado' | 'clasico';
  levelScale: number;  // 0.8 – 2.0
  clockStyle: 'clasico' | 'digital' | 'paletas';
}

const PREFS_KEY = 'poker_control_ui_v1';
export const DEFAULT_PREFS: UiPrefs = { theme: 'medianoche', timerScale: 1, blindsScale: 1, layout: 'centrado', levelScale: 1, clockStyle: 'clasico' };

export const loadPrefs = (): UiPrefs => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw);
    const clamp = (n: unknown) => Math.min(2, Math.max(0.8, Number(n) || 1));
    return { theme: getTheme(p.theme).id, timerScale: clamp(p.timerScale), blindsScale: clamp(p.blindsScale), layout: p.layout === 'clasico' ? 'clasico' : 'centrado', levelScale: clamp(p.levelScale), clockStyle: ['digital', 'paletas'].includes(p.clockStyle) ? p.clockStyle : 'clasico' };
  } catch {
    return DEFAULT_PREFS;
  }
};

export const savePrefs = (prefs: UiPrefs) => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* sin almacenamiento: solo dura la sesión */ }
};
