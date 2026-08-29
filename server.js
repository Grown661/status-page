// status-page — öffentliche Status-Seite mit Incident-Timeline
// Liest wahlweise die Daten des Schwester-Projekts uptime-monitor (data/monitor.json
// im selben Format) oder generierte Demo-Daten.
'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT) || 8214;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''; // leer = Incident-API deaktiviert
const DATA_DIR = path.join(__dirname, 'data');
const MONITOR_FILE = process.env.MONITOR_FILE || path.join(DATA_DIR, 'monitor.json');
const INCIDENTS_FILE = path.join(DATA_DIR, 'incidents.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------- Datenquellen ----------

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

// Demo-Daten, falls keine monitor.json vorhanden ist — damit die Seite
// ohne uptime-monitor sofort etwas Sinnvolles zeigt.
function demoMonitorData() {
  const targets = [
    { id: 'demo-web', name: 'Website', url: 'https://example.com' },
    { id: 'demo-api', name: 'API', url: 'https://api.example.com' },
    { id: 'demo-game', name: 'Game-Server', url: 'https://game.example.com' },
  ];
  const history = {};
  for (const t of targets) {
    const h = [];
    for (let i = 89; i >= 0; i--) {
      // deterministisch pseudo-zufällig, damit die Seite stabil aussieht
      const hash = crypto.createHash('sha1').update(t.id + i).digest()[0];
      const up = !(t.id === 'demo-game' && (i === 12 || i === 13)) && hash > 4;
      h.push({ ts: new Date(Date.now() - i * 86_400_000).toISOString(), up, ms: 40 + (hash % 120), code: up ? 200 : 0 });
    }
    history[t.id] = h;
  }
  return { targets, history, demo: true };
}

// Aggregiert History in Tages-Buckets (bis 90 Tage) für die Uptime-Balken
function dayBuckets(history) {
  const byDay = new Map();
  for (const e of history) {
    const day = e.ts.slice(0, 10);
    const b = byDay.get(day) || { total: 0, up: 0 };
    b.total++; if (e.up) b.up++;
    byDay.set(day, b);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-90)
    .map(([day, b]) => ({ day, uptime: Math.round((b.up / b.total) * 1000) / 10 }));
}

async function statusPayload() {
  const raw = await readJson(MONITOR_FILE, null);
  const data = raw && Array.isArray(raw.targets) && raw.targets.length ? raw : demoMonitorData();
  const services = data.targets.map((t) => {
    const h = (data.history && data.history[t.id]) || [];
    const last = h[h.length - 1] || null;
    const upCount = h.filter((e) => e.up).length;
    return {
      name: t.name,
      up: last ? last.up : null,
      uptimePercent: h.length ? Math.round((upCount / h.length) * 1000) / 10 : null,
      days: dayBuckets(h),
    };
  });
  const allUp = services.every((s) => s.up !== false);
  const incidents = await readJson(INCIDENTS_FILE, []);
  return {
    demo: Boolean(data.demo),
    allUp,
    services,
    incidents: incidents.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 20),
    generatedAt: new Date().toISOString(),
  };
}

// ---------- HTTP ----------

function sendJson(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 100_000) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function timingSafeEq(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

async function serveStatic(res, reqPath) {
  const rel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { sendJson(res, 404, { error: 'not found' }); }
}

async function handleApi(req, res, u) {
  if (req.method === 'GET' && u.pathname === '/api/status') {
    return sendJson(res, 200, await statusPayload());
  }

  if (req.method === 'POST' && u.pathname === '/api/incidents') {
    if (!ADMIN_TOKEN) return sendJson(res, 403, { error: 'Incident-API deaktiviert (ADMIN_TOKEN nicht gesetzt)' });
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!timingSafeEq(token, ADMIN_TOKEN)) return sendJson(res, 401, { error: 'unauthorized' });
    let body;
    try { body = JSON.parse(await readBody(req) || '{}'); }
    catch { return sendJson(res, 400, { error: 'invalid JSON' }); }
    const title = String(body.title || '').trim();
    if (!title) return sendJson(res, 400, { error: 'title fehlt' });
    const incident = {
      id: crypto.randomUUID(),
      title,
      body: String(body.body || '').trim(),
      status: ['investigating', 'identified', 'monitoring', 'resolved'].includes(body.status) ? body.status : 'investigating',
      createdAt: new Date().toISOString(),
    };
    const incidents = await readJson(INCIDENTS_FILE, []);
    incidents.push(incident);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(INCIDENTS_FILE, JSON.stringify(incidents, null, 2), 'utf8');
    return sendJson(res, 201, incident);
  }

  sendJson(res, 404, { error: 'unknown api route' });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (u.pathname.startsWith('/api/')) return await handleApi(req, res, u);
    return await serveStatic(res, u.pathname);
  } catch (err) {
    sendJson(res, 500, { error: 'internal error', detail: String(err.message || err) });
  }
});

server.listen(PORT, () => {
  console.log(`status-page läuft auf http://localhost:${PORT}${ADMIN_TOKEN ? '' : ' (Incident-API aus: ADMIN_TOKEN setzen zum Aktivieren)'}`);
});
