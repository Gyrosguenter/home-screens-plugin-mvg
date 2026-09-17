/**
 * Offizielle MVG-Linienfarben und Verkehrsmittel-Symbole.
 *
 * Farbwerte übernommen aus der aktuell gepflegten Referenzimplementierung
 * KoblerS/MMM-MVG (MMM-MVG.css) — nicht selbst erfunden, siehe
 * docs/mvg-plugin.md im Projekt-Repo. Jede U-Bahn- und S-Bahn-Linie hat eine
 * eigene, offizielle Farbe; Tram und Bus werden bei der MVG (anders als
 * U-/S-Bahn) nicht pro Linie eingefärbt, sondern einheitlich.
 */

/** Pro-Linie-Farbe für U-Bahn (U1–U8) und S-Bahn (S1–S8). */
const LINE_COLORS: Record<string, string> = {
  U1: '#52822f',
  U2: '#c2243b',
  U3: '#ec6726',
  U4: '#00a984',
  U5: '#bb7a00',
  U6: '#0065ad',
  U7: '#1a1a1a',
  U8: '#c2243b',
  S1: '#1b9fc6',
  S2: '#69a338',
  S3: '#973083',
  S4: '#136680',
  S5: '#136680',
  S6: '#008d5e',
  S7: '#883b32',
  S8: '#2d2b29',
};

/** Einheitliche Farbe je Verkehrsmittel, wenn keine Linienfarbe bekannt ist
 *  (Tram/Bus/SEV, oder eine U-/S-Bahn-Linie außerhalb der bekannten Liste). */
const MODE_FALLBACK_COLOR: Record<string, string> = {
  TRAM: '#e30613',
  BUS: '#00586a',
  REGIONAL_BUS: '#00586a',
  SEV: '#95368c',
};

/** Symbol-Form je Verkehrsmittel, wie auf den offiziellen MVG-Piktogrammen:
 *  U-Bahn und Tram eckig, S-Bahn und Bus rund. */
const MODE_SHAPE: Record<string, 'square' | 'round'> = {
  UBAHN: 'square',
  SBAHN: 'round',
  TRAM: 'square',
  BUS: 'round',
  REGIONAL_BUS: 'round',
};

/** Feste Symbolfarbe + Buchstabe je Verkehrsmittel (nicht pro Linie) — das
 *  kleine Verkehrsmittel-Icon links vom Linienschild, analog zu den
 *  u-bahn.svg/s-bahn.svg/tram.svg/bus.svg-Icons der MMM-MVG-Referenz. */
const MODE_GLYPH: Record<string, { color: string; letter: string }> = {
  UBAHN: { color: '#0068b0', letter: 'U' },
  SBAHN: { color: '#408335', letter: 'S' },
  TRAM: { color: '#d82020', letter: 'T' },
  BUS: { color: '#00586a', letter: 'B' },
  REGIONAL_BUS: { color: '#00586a', letter: 'B' },
};

export interface LineBadgeStyle {
  /** Hintergrundfarbe des Linienschilds (z. B. "U6", "S8", "19"). */
  background: string;
}

export interface ModeGlyphStyle {
  color: string;
  letter: string;
  shape: 'square' | 'round';
}

/** Farbe für das Linienschild: pro-Linie-Farbe, wenn bekannt (U-/S-Bahn),
 *  sonst die einheitliche Verkehrsmittel-Farbe. */
export function lineBadgeStyle(transportType: string, label: string): LineBadgeStyle {
  const key = label.trim().toUpperCase();
  const perLine = LINE_COLORS[key];
  if (perLine) return { background: perLine };
  return { background: MODE_FALLBACK_COLOR[transportType] ?? '#5a5a5a' };
}

/** Verkehrsmittel-Symbol (Form + feste Farbe + Buchstabe), unabhängig von der Linie. */
export function modeGlyphStyle(transportType: string): ModeGlyphStyle {
  const glyph = MODE_GLYPH[transportType] ?? { color: '#5a5a5a', letter: '?' };
  const shape = MODE_SHAPE[transportType] ?? 'square';
  return { ...glyph, shape };
}
