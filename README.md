# status-page

Öffentliche Status-Seite für die eigenen Dienste — Gesamtstatus, Uptime-Balken pro
Dienst über die verfügbare Check-Historie und eine Incident-Timeline. Ein Node-Prozess,
keine Abhängigkeiten.

## Problem

Wenn ein Dienst ausfällt, wollen Nutzer eine Antwort auf eine Frage: *"Liegt es an
mir oder am Server?"* Eine Status-Seite beantwortet das, ohne dass jemand fragen muss.
Fertige Lösungen (Statuspage, Instatus) sind für ein Homelab zu gross — das hier ist
eine Datei Server-Code plus eine HTML-Seite.

## Features

- **Gesamtstatus-Banner**: "Alle Systeme betriebsbereit" / "Störung"
- Pro Dienst: Status, Uptime-% und **Uptime-Balken** (grün/gelb/rot, ein Balken pro
  Kalendertag in der Historie). Wie weit die Balken zurückreichen, hängt allein von der
  Datenbasis ab: `uptime-monitor` behält standardmässig nur die letzten ~120 Checks
  à 60 s (≈ 2 Stunden) — dann zeigt die Seite also 1–2 Tages-Balken, keine 90 Tage.
  Angezeigt werden maximal die letzten 90 Tage, wenn die Historie so weit reicht.
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
