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

/** Wie viele Abfahrten abgefragt werden müssen, damit nach den Filtern noch
 *  `maxEntries` übrig bleiben.
 *
 *  Die MVG-API wendet `limit` VOR dem `transportTypes`-Filter an (live
 *  geprüft: Harras mit nur U-Bahn und limit=6 liefert 1 statt 6 Einträge,
 *  weil die ersten 6 Abfahrten überwiegend Busse sind). Mit einem Verkehrsmittel-
 *  oder Zielfilter muss deshalb deutlich mehr abgerufen und client-seitig
 *  gekürzt werden. */
export function fetchLimit(
  maxEntries: number,
  destinations: string[],
  transportTypes: string[] = ALL_TRANSPORT_TYPES,
): number {
  const modesFiltered = transportTypes.length < ALL_TRANSPORT_TYPES.length;
  if (destinations.length === 0 && !modesFiltered) return maxEntries;
  return Math.min(100, Math.max(60, maxEntries * 8));
}
