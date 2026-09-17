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
import { lineBadgeStyle, modeGlyphStyle } from './line-style';

const PLUGIN_ID = 'mvg-departures';

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Löst die konfigurierte Station einmalig auf (nicht bei jedem Poll) und
 *  pollt danach die Abfahrten im konfigurierten Intervall. Bei einem
 *  Fehler nach erfolgreichem Erst-Laden bleiben die zuletzt bekannten
 *  Abfahrten sichtbar, aber als veraltet markiert (Auftrag Abschnitt 34). */
function useMvgDepartures(station: string, maxEntries: number, refreshIntervalMs: number) {
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

    async function poll() {
      try {
        const data = await fetchDepartures(
          PLUGIN_ID,
          resolution!.globalId,
          maxEntries,
          // Server-seitiger Cache knapp unter dem Poll-Intervall, damit
          // mehrere Displays mit derselben Station sich einen Request teilen
          // (Auftrag Abschnitt 33), ohne selbst je eine Sekunde zu alte
          // Daten zu zeigen.
          Math.max(5000, refreshIntervalMs - 2000),
        );
        if (cancelled) return;
        setDepartures(data);
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
  }, [resolution, maxEntries, refreshIntervalMs]);

  return { stationName: resolution?.name ?? station, departures, error, stale, loading };
}

export default function MvgDeparturesPlugin({ config, style }: PluginComponentProps) {
  const station = ((config.station as string) || 'Marienplatz').trim();
  const maxEntries = Math.min(20, Math.max(1, (config.maxEntries as number) || 8));
  const refreshIntervalMs = Math.max(15000, (config.refreshIntervalMs as number) || 30000);

  const { stationName, departures, error, stale, loading } = useMvgDepartures(
    station,
    maxEntries,
    refreshIntervalMs,
  );

  return (
    <div
      style={{
        ...hostFrameStyle(style),
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5em',
      }}
    >
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
          {stationName}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55em', opacity: stale ? 0.6 : 1 }}>
          {departures.map((dep, i) => {
            const badge = lineBadgeStyle(dep.transportType, dep.label);
            const glyph = modeGlyphStyle(dep.transportType);
            const delay = dep.realtime && (dep.delayInMinutes ?? 0) > 0 ? dep.delayInMinutes : null;

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
                }}
              >
                {/* Verkehrsmittel-Symbol: feste Form/Farbe je Modus (U eckig
                    blau, S rund grün, Tram eckig rot, Bus rund petrol) —
                    analog zu den offiziellen MVG-Piktogrammen. */}
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: scalePx(24),
                    height: scalePx(24),
                    borderRadius: glyph.shape === 'round' ? '50%' : scalePx(5),
                    backgroundColor: glyph.color,
                    color: '#ffffff',
                    fontSize: '0.7em',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {glyph.letter}
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

                <span style={{ fontSize: '1.05em', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {formatTime(dep.realtimeDepartureTime ?? dep.plannedDepartureTime)}
                  {delay != null && (
                    <span style={{ color: '#e08a1e', marginLeft: '0.3em' }}>+{delay}</span>
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
