# status-page

Öffentliche Status-Seite für die eigenen Dienste — Gesamtstatus, 90-Tage-Uptime-Balken
pro Dienst und eine Incident-Timeline. Ein Node-Prozess, keine Abhängigkeiten.

## Problem

Wenn ein Dienst ausfällt, wollen Nutzer eine Antwort auf eine Frage: *"Liegt es an
mir oder am Server?"* Eine Status-Seite beantwortet das, ohne dass jemand fragen muss.
Fertige Lösungen (Statuspage, Instatus) sind für ein Homelab zu gross — das hier ist
eine Datei Server-Code plus eine HTML-Seite.

## Features

- **Gesamtstatus-Banner**: "Alle Systeme betriebsbereit" / "Störung"
- Pro Dienst: Status, Uptime-%, **90-Tage-Balken** (grün/gelb/rot je Tages-Uptime)
- **Incident-Timeline** mit Status-Verlauf (investigating → identified → monitoring → resolved)
- Incidents per API pflegbar, geschützt mit Bearer-Token (`ADMIN_TOKEN`, timing-safe verglichen)
- Ohne Datenquelle zeigt die Seite stabile **Demo-Daten** — sofort vorzeigbar
- Light/Dark automatisch nach System-Theme

## Zusammenspiel mit uptime-monitor

`status-page` liest das Datenformat des Schwester-Projekts
[`uptime-monitor`](../uptime-monitor): dessen `data/monitor.json` hierher kopieren,
symlinken oder per `MONITOR_FILE=/pfad/zu/monitor.json` direkt referenzieren —
schon zeigt die Seite echte Messwerte statt Demo-Daten.

## Stack

- **Node.js** (nur Builtins) — **kein `npm install` nötig**
- Vanilla-JS-Frontend, Auto-Refresh alle 30 s

## Setup & Start

```bash
node server.js                                        # Port 8214, Demo-Daten
ADMIN_TOKEN=geheim node server.js                     # Incident-API aktiv
MONITOR_FILE=../uptime-monitor/data/monitor.json node server.js   # echte Daten
```

Seite: `http://localhost:8214`

## API

| Methode | Pfad             | Beschreibung                                                    |
| ------- | ---------------- | --------------------------------------------------------------- |
| GET     | `/api/status`    | Gesamtstatus, Dienste mit Tages-Uptime, Incidents               |
| POST    | `/api/incidents` | `{title, body?, status?}` — braucht `Authorization: Bearer <ADMIN_TOKEN>` |

## Screenshot

_(Screenshot folgt)_

## Lizenz

MIT
