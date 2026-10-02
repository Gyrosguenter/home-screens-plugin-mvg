/**
 * Filter für eine Abfahrtstafel: Verkehrsmittel und Richtung.
 *
 * Die MVG-API kennt keine "stadteinwärts"-Angabe. Richtung wird deshalb über
 * das Fahrtziel gefiltert (Teilstring, ohne Groß-/Kleinschreibung) — z. B.
 * "Marienplatz, Münchner Freiheit" für alles Richtung Innenstadt. Ändert die
 * MVG einen Endpunkt, muss der Filter angepasst werden.
 */

/** Eingabe-Kürzel → MVG-`transportType`-Werte. Schreibweise egal
 *  (Groß-/Kleinschreibung, Bindestriche, Leerzeichen werden ignoriert). */
const MODE_ALIASES: Record<string, string[]> = {
  u: ['UBAHN'],
  ubahn: ['UBAHN'],
  s: ['SBAHN'],
  sbahn: ['SBAHN'],
  tram: ['TRAM'],
  strassenbahn: ['TRAM'],
  bus: ['BUS', 'REGIONAL_BUS'],
  regionalbus: ['REGIONAL_BUS'],
  bahn: ['BAHN'],
  regional: ['BAHN'],
};

/** Standard, wenn nichts eingestellt ist: alles außer Fernverkehr. */
export const ALL_TRANSPORT_TYPES = ['UBAHN', 'REGIONAL_BUS', 'BUS', 'TRAM', 'SBAHN'];

function splitList(text: string): string[] {
  return text
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** "U, S" → ["UBAHN", "SBAHN"]. Leere oder komplett unbekannte Eingabe → alle
 *  Verkehrsmittel (ein Tippfehler soll die Tafel nicht leer machen). */
export function parseTransportTypes(text: unknown): string[] {
  if (typeof text !== 'string') return ALL_TRANSPORT_TYPES;
  const result: string[] = [];
  for (const token of splitList(text)) {
    const key = token.toLowerCase().replace(/[\s.\-_]/g, '');
    for (const type of MODE_ALIASES[key] ?? []) {
      if (!result.includes(type)) result.push(type);
    }
  }
  return result.length > 0 ? result : ALL_TRANSPORT_TYPES;
}

/** "Marienplatz, Münchner Freiheit" → ["marienplatz", "münchner freiheit"]. */
export function parseDestinations(text: unknown): string[] {
  if (typeof text !== 'string') return [];
  return splitList(text).map((part) => part.toLowerCase());
}

/** Leerer Filter lässt alles durch. */
export function matchesDestination(destination: string, filters: string[]): boolean {
  if (filters.length === 0) return true;
  const target = destination.toLowerCase();
  return filters.some((term) => target.includes(term));
}

/** Wie viele Abfahrten abgefragt werden müssen, damit nach dem Zielfilter noch
 *  `maxEntries` übrig bleiben (der Filter läuft erst nach dem Abruf). */
export function fetchLimit(maxEntries: number, destinations: string[]): number {
  if (destinations.length === 0) return maxEntries;
  return Math.min(60, Math.max(40, maxEntries * 4));
}
