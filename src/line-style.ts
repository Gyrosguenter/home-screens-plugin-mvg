/**
 * Offizielle MVG-Linienfarben und Verkehrsmittel-Symbole.
 *
 * Farbwerte übernommen aus der aktuell gepflegten Referenzimplementierung
 * KoblerS/MMM-MVG (MMM-MVG.css) — nicht selbst erfunden, siehe
 * docs/mvg-plugin.md im Projekt-Repo. Jede U-Bahn- und S-Bahn-Linie hat eine
 * eigene, offizielle Farbe; Tram und Bus werden bei der MVG (anders als
 * U-/S-Bahn) nicht pro Linie eingefärbt, sondern einheitlich.
 */

/** Pro-Linie-Farbe für U-Bahn (U1–U8) und S-Bahn (S1–S8).
 *
 *  S8 ist bewusst NICHT hier drin, sondern unten als Sonderfall behandelt:
 *  Die S8 (Flughafenlinie) trägt seit 1992 eine gelb/schwarze Sonderkennung
 *  ("Hummel"-Design), keine reguläre Flächenfarbe wie die übrigen Linien —
 *  bestätigt über mehrere unabhängige Quellen (s-bahn-muenchen.de,
 *  muenchenwiki.de), nicht nur aus der MMM-MVG-Referenz übernommen, die hier
 *  fälschlich nur ein einheitliches Dunkelgrau für S8 führt.
 *
 *  Achtung: Die MVG hat die S-Bahn-Linienfarben im Dezember 2024 bei der
 *  Wiedereinführung der S5 teilweise neu zugeordnet (S8 war zwischenzeitlich
 *  an die alte S5-Farbe angeglichen). Die Werte für S1–S7 stammen aus der
 *  aktuell gepflegten MMM-MVG-Referenz (Stand 2026-08-17) und wurden nicht
 *  einzeln gegen die offizielle MVG-Farbtabelle nachverifiziert — falls eine
 *  Linie sichtbar falsch aussieht, bitte melden. */
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
};

/** S8 (Flughafen-Linie): gelb/schwarze Sonderkennung statt Flächenfarbe. */
const S8_BACKGROUND = '#ffcc00';
const S8_TEXT_COLOR = '#000000';

/** Einheitliche Farbe je Verkehrsmittel, wenn keine Linienfarbe bekannt ist
 *  (Tram/Bus/SEV, oder eine U-/S-Bahn-Linie außerhalb der bekannten Liste). */
const MODE_FALLBACK_COLOR: Record<string, string> = {
  TRAM: '#e30613',
  BUS: '#00586a',
  REGIONAL_BUS: '#00586a',
  SEV: '#95368c',
};

// Das kleine Verkehrsmittel-Symbol links vom Linienschild ist keine
// CSS-Konstruktion mehr, sondern das Original-SVG-Piktogramm — siehe
// src/mode-icons.tsx.

export interface LineBadgeStyle {
  /** Hintergrundfarbe des Linienschilds (z. B. "U6", "S8", "19"). */
  background: string;
  /** Textfarbe — weiß für fast alle Linien, schwarz für den gelben S8-Sonderfall. */
  textColor: string;
}

/** Farbe für das Linienschild: pro-Linie-Farbe, wenn bekannt (U-/S-Bahn),
 *  Sonderfall S8 (gelb/schwarz), sonst die einheitliche Verkehrsmittel-Farbe. */
export function lineBadgeStyle(transportType: string, label: string): LineBadgeStyle {
  const key = label.trim().toUpperCase();
  if (key === 'S8') return { background: S8_BACKGROUND, textColor: S8_TEXT_COLOR };
  const perLine = LINE_COLORS[key];
  if (perLine) return { background: perLine, textColor: '#ffffff' };
  return { background: MODE_FALLBACK_COLOR[transportType] ?? '#5a5a5a', textColor: '#ffffff' };
}
