/**
 * Zentrale Kapselung der MVG-Schnittstelle (https://www.mvg.de/api/bgw-pt/v3).
 *
 * Diese API ist NICHT offiziell dokumentiert — es ist die interne
 * Schnittstelle, die mvg.de selbst für seine eigene Abfahrtsanzeige nutzt
 * (reverse-engineered, siehe docs/mvg-api.md im Projekt-Repo). Sie kann sich
 * jederzeit ohne Vorankündigung ändern. Deshalb bewusst an einer einzigen
 * Stelle im Code gekapselt (Projektauftrag Abschnitt 24) — falls sich
 * Endpunkte, Header oder Feldnamen ändern, muss nur diese Datei angepasst
 * werden.
 *
 * Alle Requests laufen über den host-seitigen `pluginFetch`-Proxy, nicht
 * direkt aus dem Browser des Displays — Secrets/Header bleiben serverseitig,
 * CORS ist kein Thema, und der Host cached serverseitig (cacheTtlMs), sodass
 * mehrere Displays, die dieselbe Station abfragen, nicht mehrfach gegen die
 * MVG-API laufen.
 */

const API_BASE = 'https://www.mvg.de/api/bgw-pt/v3';

/** Statischer, öffentlicher Web-Client-Header aus der offiziellen mvg.de-Website
 *  (kein pro-Nutzer-Secret) — siehe docs/mvg-api.md für die Live-Verifikation. */
const MVG_HEADERS: Record<string, string> = {
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'X-Requested-With': 'XMLHttpRequest',
  'X-MVG-Authorization-Key': '5af1beca494712ed38d313714d4caff6',
  'Referer': 'https://www.mvg.de/dienste/abfahrtszeiten.html',
  'Accept-Language': 'de-DE,de;q=0.9',
};

export interface MvgLocation {
  globalId: string;
  name: string;
  place: string;
  transportTypes: string[];
  type: string;
}

export interface MvgDeparture {
  plannedDepartureTime: number;
  realtime: boolean;
  delayInMinutes?: number;
  realtimeDepartureTime: number;
  transportType: string;
  label: string;
  destination: string;
  cancelled: boolean;
  sev: boolean;
  platform?: number;
}

export interface MvgStationResolution {
  globalId: string;
  name: string;
}

/** Fehler, der eine benutzerfreundliche Meldung statt eines Absturzes auslöst
 *  (Projektauftrag Abschnitt 34: Dashboard darf bei MVG-Ausfall nicht abstürzen). */
export class MvgApiError extends Error {}

type PluginFetch = (
  pluginId: string,
  options: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    cacheTtlMs?: number;
  },
) => Promise<Response>;

function getPluginFetch(): PluginFetch {
  const fn = window.__HS_SDK__?.pluginFetch;
  if (!fn) throw new MvgApiError('SDK nicht verfügbar');
  return fn as PluginFetch;
}

/** Sucht eine Haltestelle nach Namen und liefert den ersten Treffer mit
 *  globalId. Ergebnis wird vom Aufrufer gecacht (siehe useMvgDepartures) —
 *  die Namenssuche selbst ändert sich für eine feste Konfiguration nie, muss
 *  also nicht bei jedem Poll wiederholt werden. */
export async function resolveStation(
  pluginId: string,
  query: string,
): Promise<MvgStationResolution> {
  const pluginFetch = getPluginFetch();
  const url = `${API_BASE}/locations?${new URLSearchParams({ query }).toString()}`;
  const res = await pluginFetch(pluginId, {
    url,
    headers: MVG_HEADERS,
    // Stationsnamen ändern sich praktisch nie — 1h Cache ist unkritisch und
    // spart wiederholte Lookups bei jedem Modul-Neustart.
    cacheTtlMs: 60 * 60 * 1000,
  });
  if (!res.ok) {
    throw new MvgApiError(`Stationssuche fehlgeschlagen (HTTP ${res.status})`);
  }
  const data = (await res.json()) as MvgLocation[];
  const first = data.find((loc) => loc.type === 'STATION') ?? data[0];
  if (!first?.globalId) {
    throw new MvgApiError(`Keine Haltestelle gefunden für „${query}“`);
  }
  return { globalId: first.globalId, name: first.name };
}

/** Holt Live-Abfahrten für eine Station (per globalId). */
export async function fetchDepartures(
  pluginId: string,
  globalId: string,
  limit: number,
  cacheTtlMs: number,
): Promise<MvgDeparture[]> {
  const pluginFetch = getPluginFetch();
  const params = new URLSearchParams({
    globalId,
    limit: String(limit),
    offsetInMinutes: '0',
    transportTypes: 'UBAHN,REGIONAL_BUS,BUS,TRAM,SBAHN',
  });
  const res = await pluginFetch(pluginId, {
    url: `${API_BASE}/departures?${params.toString()}`,
    headers: MVG_HEADERS,
    cacheTtlMs,
  });
  if (!res.ok) {
    throw new MvgApiError(`Abfahrten nicht verfügbar (HTTP ${res.status})`);
  }
  return (await res.json()) as MvgDeparture[];
}
