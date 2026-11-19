import React, { useEffect, useRef, useState } from 'react';

export type ClockStyle = 'clasico' | 'digital' | 'paletas';

interface ClockDisplayProps {
  value: string;           // "09:57"
  variant: ClockStyle;
  litColor: string;        // color de los segmentos encendidos (digital)
  cardColor: string;       // fondo de las paletas
  cardLine: string;        // línea del medio de las paletas
}

// El tamaño se hereda del font-size del contenedor (así funcionan las barras de tamaño).
export const ClockDisplay: React.FC<ClockDisplayProps> = ({ value, variant, litColor, cardColor, cardLine }) => {
  if (variant === 'digital') return <SevenSegment value={value} color={litColor} />;
  if (variant === 'paletas') return <FlipClock value={value} cardColor={cardColor} cardLine={cardLine} />;
  return <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: '-0.04em' }}>{value}</span>;
};

/* ---------------- Digital: 7 segmentos dibujados en SVG (no depende de fuentes) ---------------- */

const W = 56, H = 100, T = 10, G = 1.6;
const hSeg = (yc: number) => {
  const x1 = T / 2 + G, x2 = W - T / 2 - G, h = T / 2;
  return `${x1},${yc} ${x1 + h},${yc - h} ${x2 - h},${yc - h} ${x2},${yc} ${x2 - h},${yc + h} ${x1 + h},${yc + h}`;
};
const vSeg = (xc: number, y1: number, y2: number) => {
  const h = T / 2;
  return `${xc},${y1} ${xc + h},${y1 + h} ${xc + h},${y2 - h} ${xc},${y2} ${xc - h},${y2 - h} ${xc - h},${y1 + h}`;
};
const SEGMENTS: Record<string, string> = {
  a: hSeg(T / 2),
  b: vSeg(W - T / 2, T / 2 + G, H / 2 - G),
  c: vSeg(W - T / 2, H / 2 + G, H - T / 2 - G),
  d: hSeg(H - T / 2),
  e: vSeg(T / 2, H / 2 + G, H - T / 2 - G),
  f: vSeg(T / 2, T / 2 + G, H / 2 - G),
  g: hSeg(H / 2),
};
const DIGITS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc',
  '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
};

const SevenSegment: React.FC<{ value: string; color: string }> = ({ value, color }) => {
  const DIGIT_GAP = 14, COLON_W = 22;
  let x = 0;
  const parts = value.split('').map((ch, i) => {
    const startX = x;
    if (ch === ':') {
      x += COLON_W + DIGIT_GAP;
      return (
        <g key={i} transform={`translate(${startX},0)`}>
          <rect x={COLON_W / 2 - T / 2} y={H * 0.3 - T / 2} width={T} height={T} rx={2} fill={color} />
          <rect x={COLON_W / 2 - T / 2} y={H * 0.7 - T / 2} width={T} height={T} rx={2} fill={color} />
        </g>
      );
    }
    x += W + DIGIT_GAP;
    const lit = DIGITS[ch] || '';
    return (
      <g key={i} transform={`translate(${startX},0) skewX(-6) translate(6,0)`}>
        {Object.entries(SEGMENTS).map(([seg, pts]) => (
          <polygon key={seg} points={pts} fill={color} opacity={lit.includes(seg) ? 1 : 0.07} />
        ))}
      </g>
    );
  });
  const totalW = x - DIGIT_GAP + 8;
  return (
    <svg role="img" aria-label={value} viewBox={`-4 -4 ${totalW + 8} ${H + 8}`}
      style={{ height: '0.82em', width: 'auto', display: 'block', overflow: 'visible', filter: `drop-shadow(0 0 0.06em ${color})` }}>
      {parts}
    </svg>
  );
};

/* ---------------- Paletas: reloj de cartelitos que se dan vuelta ---------------- */

const FLIP_CSS = `
@keyframes pd-flip-top { from { transform: rotateX(0deg); } to { transform: rotateX(-90deg); } }
@keyframes pd-flip-bottom { from { transform: rotateX(90deg); } to { transform: rotateX(0deg); } }
.pd-flip-top { animation: pd-flip-top 0.28s ease-in forwards; }
.pd-flip-bottom { animation: pd-flip-bottom 0.28s ease-out 0.28s both; }
@media (prefers-reduced-motion: reduce) { .pd-flip-top, .pd-flip-bottom { animation: none; display: none; } }
`;

const FlipClock: React.FC<{ value: string; cardColor: string; cardLine: string }> = ({ value, cardColor, cardLine }) => (
  <span role="img" aria-label={value} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.06em', fontFamily: "'Space Grotesk', 'Outfit', system-ui, sans-serif", fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
    <style>{FLIP_CSS}</style>
    {value.split('').map((ch, i) =>
      ch === ':'
        ? <span key={i} style={{ padding: '0 0.04em', lineHeight: 1, opacity: 0.85 }}>:</span>
        : <FlipDigit key={i} digit={ch} cardColor={cardColor} cardLine={cardLine} />
    )}
  </span>
);

const FlipDigit: React.FC<{ digit: string; cardColor: string; cardLine: string }> = ({ digit, cardColor, cardLine }) => {
  const [prev, setPrev] = useState(digit);   // número anterior, visible hasta que termina el giro
  const [flipKey, setFlipKey] = useState(0);
  const current = useRef(digit);

  useEffect(() => {
    if (digit === current.current) return;
    setPrev(current.current);
    current.current = digit;
    setFlipKey(k => k + 1);
  }, [digit]);

  const flipping = prev !== digit;
  const card: React.CSSProperties = { position: 'relative', display: 'inline-block', width: '0.7em', height: '1.08em', perspective: '3em' };
  const half = (top: boolean): React.CSSProperties => ({
    position: 'absolute', left: 0, right: 0, height: '50%', overflow: 'hidden', background: cardColor,
    top: top ? 0 : '50%', borderRadius: top ? '0.08em 0.08em 0 0' : '0 0 0.08em 0.08em',
    transformOrigin: top ? 'bottom' : 'top', backfaceVisibility: 'hidden',
  });
  const glyph = (top: boolean): React.CSSProperties => ({
    position: 'absolute', left: 0, right: 0, height: '1.08em', lineHeight: '1.08em', textAlign: 'center', top: top ? 0 : '-0.54em',
  });

  return (
    <span style={card}>
      {/* Fijas: arriba el número nuevo, abajo el anterior hasta que termine el giro */}
      <span style={half(true)}><span style={glyph(true)}>{digit}</span></span>
      <span style={half(false)}><span style={glyph(false)}>{flipping ? prev : digit}</span></span>
      {flipping && (
        <span key={flipKey}>
          <span className="pd-flip-top" style={{ ...half(true), zIndex: 2 }}><span style={glyph(true)}>{prev}</span></span>
          <span className="pd-flip-bottom" style={{ ...half(false), zIndex: 2 }}
            onAnimationEnd={() => setPrev(digit)}>
            <span style={glyph(false)}>{digit}</span>
          </span>
        </span>
      )}
      {/* Línea del medio de la paleta */}
      <span style={{ position: 'absolute', left: 0, right: 0, top: 'calc(50% - 0.012em)', height: '0.024em', background: cardLine, zIndex: 3 }} />
    </span>
  );
};
