import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { hostFrameStyle, scalePx } from './host-style';
import {
  resolveStation,
  fetchDepartures,
  MvgApiError,
  type MvgDeparture,
  type MvgStationResolution,
} from './mvg';
import { lineBadgeStyle } from './line-style';
import { ModeIcon } from './mode-icons';
import {
  fetchLimit,
  matchesDestination,
  parseDestinations,
  parseTransportTypes,
} from './filters';

const PLUGIN_ID = 'mvg-departures';

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Minuten bis zur Abfahrt als kurzer Countdown-Text ("jetzt", "1 min",
 *  "12 min") statt einer absoluten Uhrzeit — moderneres, auf einen Blick
 *  erfassbares Format, wie vom Nutzer per Referenz-Mockup gewünscht. */
function formatCountdown(ms: number, now: number): string {
  const diffMin = Math.round((ms - now) / 60000);
  if (diffMin <= 0) return 'jetzt';
  return `${diffMin} min`;
}

/** Aktueller Zeitstempel, der alle `intervalMs` neu gesetzt wird — treibt den
 *  Countdown-Text zwischen zwei MVG-Datenabfragen weiter, statt bis zum
 *  nächsten Poll (bis zu `refreshIntervalMs`) stehen zu bleiben. */
function useNow(intervalMs: number): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Eine Haltestelle samt Anzeige-Einstellungen, aus der Modul-Config gelesen. */
interface StationSpec {
  station: string;
  title: string;
  /** Kommagetrennte Verkehrsmittel-Kürzel, leer = alle. */
  modes: string;
  /** Kommagetrennte Ziel-Stichwörter (Richtungsfilter), leer = alle. */
  destinations: string;
}

function readStringConfig(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** Station 1 ist immer da (Standard Marienplatz, wie bisher); Station 2 nur,
 *  wenn ein Name eingetragen ist. */
function readStations(config: Record<string, unknown>): StationSpec[] {
  const stations: StationSpec[] = [
    {
      station: readStringConfig(config, 'station') || 'Marienplatz',
      title: readStringConfig(config, 'stationTitle'),
      modes: readStringConfig(config, 'modes'),
      destinations: readStringConfig(config, 'destinations'),
    },
  ];
  const second = readStringConfig(config, 'station2');
  if (second) {
    stations.push({
      station: second,
      title: readStringConfig(config, 'station2Title'),
      modes: readStringConfig(config, 'station2Modes'),
      destinations: readStringConfig(config, 'station2Destinations'),
    });
  }
  return stations;
}

/** Löst die konfigurierte Station einmalig auf (nicht bei jedem Poll) und
 *  pollt danach die Abfahrten im konfigurierten Intervall. Bei einem
 *  Fehler nach erfolgreichem Erst-Laden bleiben die zuletzt bekannten
 *  Abfahrten sichtbar, aber als veraltet markiert (Auftrag Abschnitt 34). */
function useMvgDepartures(spec: StationSpec, maxEntries: number, refreshIntervalMs: number) {
  const { station, modes, destinations } = spec;
  const [resolution, setResolution] = React.useState<MvgStationResolution | null>(null);
  const [departures, setDepartures] = React.useState<MvgDeparture[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [stale, setStale] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  // Station-Auflösung: läuft neu, wenn sich der konfigurierte Name ändert.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResolution(null);
    setDepartures(null);
    setStale(false);

    resolveStation(PLUGIN_ID, station)
      .then((res) => {
        if (!cancelled) setResolution(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof MvgApiError ? err.message : 'MVG-Daten momentan nicht verfügbar');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [station]);

  // Abfahrten-Polling: startet, sobald die Station aufgelöst ist.
  React.useEffect(() => {
    if (!resolution) return;
    let cancelled = false;
    const transportTypes = parseTransportTypes(modes);
    const destinationTerms = parseDestinations(destinations);

    async function poll() {
      try {
        const data = await fetchDepartures(
          PLUGIN_ID,
          resolution!.globalId,
          fetchLimit(maxEntries, destinationTerms),
          // Server-seitiger Cache knapp unter dem Poll-Intervall, damit
          // mehrere Displays mit derselben Station sich einen Request teilen
          // (Auftrag Abschnitt 33), ohne selbst je eine Sekunde zu alte
          // Daten zu zeigen.
          Math.max(5000, refreshIntervalMs - 2000),
          transportTypes,
        );
        if (cancelled) return;
        setDepartures(
          data.filter((dep) => matchesDestination(dep.destination, destinationTerms)).slice(0, maxEntries),
        );
        setError(null);
        setStale(false);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof MvgApiError ? err.message : 'MVG-Daten momentan nicht verfügbar';
        setLoading(false);
        setDepartures((prev) => {
          // Erst-Fehler ohne je erfolgreich geladene Daten: echter Fehlerzustand.
          // Fehler NACH erfolgreichem Laden: alte Daten behalten, nur als veraltet markieren.
          if (prev && prev.length > 0) {
            setStale(true);
            setError(null);
          } else {
            setError(message);
          }
          return prev;
        });
      }
    }

    poll();
    const id = setInterval(poll, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [resolution, maxEntries, refreshIntervalMs, modes, destinations]);

  return { stationName: resolution?.name ?? station, departures, error, stale, loading };
}

interface StationBoardProps {
  spec: StationSpec;
  maxEntries: number;
  refreshIntervalMs: number;
  now: number;
}

function StationBoard({ spec, maxEntries, refreshIntervalMs, now }: StationBoardProps) {
  const { stationName, departures, error, stale, loading } = useMvgDepartures(
    spec,
    maxEntries,
    refreshIntervalMs,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5em', minHeight: 0 }}>
      <div
        style={{
          fontSize: '1.3em',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '0.5em',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {spec.title || stationName}
        </span>
        {stale && (
          <span style={{ fontSize: '0.6em', opacity: 0.6, fontWeight: 400, whiteSpace: 'nowrap' }}>
            veraltet
          </span>
        )}
      </div>

      {loading && !departures && (
        <div style={{ fontSize: '0.85em', opacity: 0.6 }}>Lade Abfahrten…</div>
      )}

      {error && !departures && (
        <div style={{ fontSize: '0.85em', opacity: 0.75 }}>MVG-Daten momentan nicht verfügbar</div>
      )}

      {departures && departures.length === 0 && (
        <div style={{ fontSize: '0.85em', opacity: 0.6 }}>Keine Abfahrten gefunden</div>
      )}

      {departures && departures.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3em', opacity: stale ? 0.6 : 1 }}>
          {departures.map((dep, i) => {
            const badge = lineBadgeStyle(dep.transportType, dep.label);
            const delay = dep.realtime && (dep.delayInMinutes ?? 0) > 0 ? dep.delayInMinutes : null;
            const departureMs = dep.realtimeDepartureTime ?? dep.plannedDepartureTime;

            return (
              // globalId ist pro Station stabil, aber innerhalb einer Antwort
              // nicht pro Zeile eindeutig — Zeilen-Index reicht hier als Key.
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5em',
                  opacity: dep.cancelled ? 0.5 : 1,
                  paddingBottom: '0.55em',
                  borderBottom: i < departures.length - 1
                    ? '1px solid rgba(255, 255, 255, 0.08)'
                    : 'none',
                  transition: 'opacity 0.4s ease',
                }}
              >
                {/* Verkehrsmittel-Symbol: Original-MVG-Piktogramm (SVG),
                    siehe src/mode-icons.tsx. */}
                <span style={{ flexShrink: 0, display: 'inline-flex' }}>
                  <ModeIcon transportType={dep.transportType} size={scalePx(36)} />
                </span>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: scalePx(40),
                    height: scalePx(26),
                    padding: '0 0.5em',
                    borderRadius: scalePx(4),
                    backgroundColor: badge.background,
                    color: badge.textColor,
                    fontSize: '0.85em',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {dep.label}
                </span>

                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '1.05em',
                    textDecoration: dep.cancelled ? 'line-through' : 'none',
                  }}
                >
                  {dep.destination}
                </span>

                {dep.sev && (
                  <span style={{ fontSize: '0.7em', opacity: 0.7, flexShrink: 0 }}>SEV</span>
                )}
                {dep.cancelled && (
                  <span style={{ fontSize: '0.8em', opacity: 0.8, flexShrink: 0 }}>Entfällt</span>
                )}

                <span
                  style={{
                    fontSize: '1.05em',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: '#34d399',
                    flexShrink: 0,
                    transition: 'opacity 0.4s ease',
                  }}
                  title={formatTime(departureMs)}
                >
                  {formatCountdown(departureMs, now)}
                  {delay != null && (
                    <span style={{ color: '#e08a1e', marginLeft: '0.3em', fontSize: '0.75em' }}>
                      +{delay}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MvgDeparturesPlugin({ config, style }: PluginComponentProps) {
  const stations = readStations(config);
  const maxEntries = Math.min(20, Math.max(1, (config.maxEntries as number) || 8));
  const refreshIntervalMs = Math.max(15000, (config.refreshIntervalMs as number) || 30000);
  // Tickt öfter als der Datenabruf, damit der "X min"-Countdown zwischen zwei
  // Polls weiterläuft statt bis zu refreshIntervalMs stehen zu bleiben.
  const now = useNow(15000);

  return (
    <div
      style={{
        ...hostFrameStyle(style),
        display: 'flex',
        flexDirection: 'column',
        gap: '1.2em',
      }}
    >
      {stations.map((spec, i) => (
        <StationBoard
          // Key enthält den Namen, damit ein Stationswechsel den Hook-Zustand
          // (Auflösung, Abfahrten) sauber neu startet.
          key={`${i}:${spec.station}`}
          spec={spec}
          maxEntries={maxEntries}
          refreshIntervalMs={refreshIntervalMs}
          now={now}
        />
      ))}
    </div>
  );
}
