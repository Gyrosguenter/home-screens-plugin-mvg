# MVG Abfahrten — Home Screens Plugin

Natives [Home Screens](https://homescreens.dev)-Plugin (kein iFrame) für Live-Abfahrten des Münchner Nahverkehrs (MVG). Zeigt Linie, Ziel, Abfahrtszeit und Echtzeit-Verspätung für eine konfigurierte Haltestelle.

Teil des Projekts [home-screens-magic-mirror](https://github.com/Gyrosguenter/home-screens-magic-mirror) (privates Repo, Proxmox-Hub + Raspberry-Pi-Kiosk) — als eigenes, öffentliches Repo geführt, damit die Plugin-Tarball-URL für die Home-Screens-Installation ohne Authentifizierung erreichbar ist, ohne interne Netzwerkdetails aus dem Hauptprojekt offenzulegen.

**Status: MVP (Phase 5 des Projektauftrags)** — eine Station, keine Linien-/Richtungsfilter, kein Mindestvorlauf. Erweiterungen folgen in Phase 6.

> [!CAUTION]
> Dieses Plugin ist ein unabhängiges Projekt und steht in keiner Verbindung zur MVG (Münchner Verkehrsgesellschaft mbH). Es nutzt eine nicht offiziell dokumentierte, reverse-engineerte Schnittstelle, die sich jederzeit ändern kann.

## Konfiguration

| Feld | Beschreibung |
|---|---|
| Haltestelle | Freitext-Stationsname (z. B. „Marienplatz“). Wird bei jeder Konfigurationsänderung neu über die MVG-Stationssuche aufgelöst, danach gecacht. |
| Anzahl Abfahrten | 1–20 |
| Aktualisierung (ms) | 15.000–300.000, Standard 30.000 (Auftrag Abschnitt 33) |

## Architektur

- `src/mvg.ts` — zentrale Kapselung der MVG-Schnittstelle (Auftrag Abschnitt 24): Endpunkte, Header, Typen. Einzige Stelle, die bei einer API-Änderung angepasst werden muss.
- `src/index.tsx` — React-Komponente, nutzt `pluginFetch` (serverseitiger Proxy des Hosts) statt direkter Browser-Requests — Secrets/Header bleiben serverseitig, mehrere Displays teilen sich den Cache.
- Fehlerbehandlung: bei einem Fehler nach erfolgreichem Erst-Laden bleiben die letzten Abfahrten sichtbar, aber als „veraltet“ markiert (Auftrag Abschnitt 34). Ohne je erfolgreich geladene Daten erscheint stattdessen eine Fehlermeldung, kein Absturz.

## Build & Deployment

```bash
npm install
npm run build   # erzeugt dist/bundle.js
```

Deployment auf den Home-Screens-Hub erfolgt **nicht** über den öffentlichen Plugin-Marketplace, sondern über "Plugins → Aus URL installieren" mit einer `.tar.gz`-URL. Tarball-Struktur laut offizieller Plugin-Doku (ein Wurzelverzeichnis, das `manifest.json` und `dist/` enthält):

```bash
mkdir -p /tmp/mvg-plugin-pkg/mvg-departures/dist
cp manifest.json /tmp/mvg-plugin-pkg/mvg-departures/
cp dist/bundle.js dist/bundle.js.map /tmp/mvg-plugin-pkg/mvg-departures/dist/
tar -czf mvg-departures-vX.Y.Z.tar.gz -C /tmp/mvg-plugin-pkg mvg-departures
```

Der Tarball wird als GitHub-Release-Asset in diesem Repo veröffentlicht (Tag `mvg-departures-vX.Y.Z`); die Release-Asset-URL ist der Installations-Link im Editor.

## Entwicklung

`npm run dev` startet einen lokalen Dev-Server (Port 5173) mit Auto-Reload — im Editor unter Plugins → Developer-Tab lädbar, solange der Dev-Server vom Browser aus erreichbar ist, der den Editor anzeigt.
