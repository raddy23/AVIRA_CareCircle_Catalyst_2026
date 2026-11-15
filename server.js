"use strict";
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { predict } = require('./lib/careSignals');

const PORT = Number(process.env.PORT || 8080);
const demo = process.env.DEMO_MODE !== 'false';
const SECRET = process.env.APP_SECRET || crypto.randomBytes(32).toString('hex');
const dataPath = process.env.DATA_PATH || path.join(__dirname, 'data.json');

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

const seed = {
  users: [
    { id: 'elder', name: 'Anita Rao', role: 'elder', pass: '2468', email: 'anita@example.invalid' },
    { id: 'carer', name: 'Meera Rao', role: 'carer', pass: '1357', email: 'meera@example.invalid' },
    { id: 'family', name: 'Arjun Rao', role: 'family', pass: '9876', email: 'arjun@example.invalid' }
  ],
  medications: [
    { id: 'm1', name: 'Morning medicine (demo)', dose: 'As prescribed', time: '09:00', notes: 'Confirm prescription with clinician', active: true },
    { id: 'm2', name: 'Evening medicine (demo)', dose: 'As prescribed', time: '20:00', notes: 'Demo only', active: true }
  ],
  appointments: [
    { id: 'a1', title: 'Routine health review', date: getToday(), time: '17:00', location: 'Clinic / teleconsultation', notes: 'Demo appointment' }
  ],
  logs: [],
  alerts: [],
  emailLog: [],
  preferences: { reminderLeadMinutes: 30, shareWithFamily: true }
};

let db;
try {
  db = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch {
  db = structuredClone(seed);
}

function save() {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Failed to save data.json:', err.message);
  }
}

function uid() {
  return crypto.randomBytes(8).toString('hex');
}

function send(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(obj));
}

function signedToken(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, exp: Date.now() + 12 * 3600e3 })).toString('base64url');
  return payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function identity(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const [a, b] = (token || '').split('.');
  if (!a || !b) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(a).digest('base64url');
  if (b.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(b), Buffer.from(expected))) return null;
  try {
    const x = JSON.parse(Buffer.from(a, 'base64url').toString());
    return x.exp > Date.now() ? db.users.find(y => y.id === x.id) : null;
  } catch {
    return null;
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', x => {
      s += x;
      if (s.length > 50000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(s || '{}'));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function clean(v, max = 140) {
  return String(v ?? '').trim().slice(0, max);
}

function canEdit(u) {
  return u && (u.role === 'elder' || u.role === 'carer');
}

function isDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
}

function isTime(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function summary() {
  const taken = db.logs.filter(x => x.status === 'taken').length;
  const missed = db.logs.filter(x => x.status === 'missed').length;
  return {
    medications: db.medications.filter(x => x.active).length,
    appointments: db.appointments.length,
    taken,
    missed,
    adherence: (taken + missed) > 0 ? Math.round((100 * taken) / (taken + missed)) : null
  };
}

function due(now = new Date()) {
  const d = now.toISOString().slice(0, 10);
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const lead = +db.preferences.reminderLeadMinutes || 30;
  const out = [];

  for (const m of db.medications.filter(x => x.active)) {
    const [h, mm] = m.time.split(':').map(Number);
    const target = h * 60 + mm;
    if (!db.logs.some(x => x.medicationId === m.id && x.date === d) && mins >= target - lead && mins <= target + 60) {
      out.push({
        type: mins > target ? 'overdue' : 'upcoming',
        medicationId: m.id,
        label: m.name,
        time: m.time,
        date: d
      });
    }
  }

  for (const a of db.appointments) {
    if (a.date === d) {
      const [h, mm] = a.time.split(':').map(Number);
      const t = h * 60 + mm;
      if (mins >= t - lead && mins <= t) {
        out.push({
          type: 'appointment',
          appointmentId: a.id,
          label: a.title,
          time: a.time,
          date: d
        });
      }
    }
  }

  return out;
}

async function emailNotify(alert) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.REMINDER_EMAIL;
  const from = process.env.FROM_EMAIL;
  if (!key || !to || !from) return { mode: 'preview-only', status: 'not-sent' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: to.split(',').map(x => x.trim()).filter(Boolean),
        subject: 'CareCircle reminder: ' + alert.type,
        text: alert.label + ' at ' + alert.time + ' UTC. Review schedule with the elder; do not change medication without medical advice.'
      })
    });
    return { mode: 'resend', status: r.ok ? 'sent' : 'failed', code: r.status };
  } catch {
    return { mode: 'resend', status: 'failed' };
  }
}

async function runReminders(now = new Date()) {
  const alerts = due(now);
  let n = 0;
  for (const a of alerts) {
    const key = [a.type, a.medicationId || a.appointmentId, a.date, a.time].join(':');
    if (db.alerts.some(x => x.key === key)) continue;
    const notice = { id: uid(), key, ...a, createdAt: now.toISOString() };
    db.alerts.unshift(notice);
    const emailResult = await emailNotify(notice);
    db.emailLog.unshift({ ...notice, ...emailResult });
    n++;
  }
  if (n) save();
  return {
    newAlerts: n,
    alerts: db.alerts.slice(0, 30),
    emailMode: process.env.RESEND_API_KEY ? 'configured' : 'preview-only',
    timezone: 'UTC (prototype)'
  };
}

async function handler(req, res) {
  let pathname;
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    return send(res, 400, { error: 'Bad URL' });
  }

  // Favicon handler
  if (pathname === '/favicon.ico') {
    res.writeHead(204, { 'Cache-Control': 'public, max-age=86400' });
    return res.end();
  }

  // Public Health endpoint
  if (pathname === '/api/health') {
    return send(res, 200, { ok: true, name: 'AVIRA CareCircle', demo, version: '1.0.0' });
  }

  // Login endpoint
  if (pathname === '/api/login' && req.method === 'POST') {
    const b = await parseBody(req);
    const u = db.users.find(x => x.id === b.user && x.pass === b.passcode);
    if (!u) return send(res, 401, { error: 'Incorrect demo passcode' });
    return send(res, 200, {
      token: signedToken(u),
      user: { id: u.id, name: u.name, role: u.role }
    });
  }

  // Authenticated API routes
  if (pathname.startsWith('/api/')) {
    const u = identity(req);
    if (!u) return send(res, 401, { error: 'Log in first' });

    if (pathname === '/api/state' && req.method === 'GET') {
      return send(res, 200, {
        user: { id: u.id, name: u.name, role: u.role },
        medications: db.medications,
        appointments: db.appointments,
        logs: db.logs,
        alerts: db.alerts.slice(0, 30),
        emailLog: db.emailLog.slice(0, 12),
        summary: summary(),
        preferences: db.preferences,
        timezone: 'UTC (demo only)'
      });
    }

    if (pathname === '/api/medications' && req.method === 'POST') {
      if (!canEdit(u)) return send(res, 403, { error: 'Viewing access only' });
      const b = await parseBody(req);
      if (!clean(b.name) || !isTime(b.time)) return send(res, 400, { error: 'Name and HH:MM time required' });
      const m = {
        id: uid(),
        name: clean(b.name),
        dose: clean(b.dose || 'As prescribed'),
        time: b.time,
        notes: clean(b.notes, 250),
        active: true
      };
      db.medications.push(m);
      save();
      return send(res, 201, m);
    }

    if (pathname.startsWith('/api/medications/') && req.method === 'PATCH') {
      if (!canEdit(u)) return send(res, 403, { error: 'Viewing access only' });
      const id = pathname.split('/').pop();
      const m = db.medications.find(x => x.id === id);
      if (!m) return send(res, 404, { error: 'Not found' });
      const b = await parseBody(req);
      if (b.time !== undefined && !isTime(b.time)) return send(res, 400, { error: 'Invalid time' });
      for (const f of ['name', 'dose', 'notes']) {
        if (b[f] !== undefined) m[f] = clean(b[f], 200);
      }
      if (b.time !== undefined) m.time = b.time;
      if (typeof b.active === 'boolean') m.active = b.active;
      save();
      return send(res, 200, m);
    }

    if (pathname.startsWith('/api/medications/') && req.method === 'DELETE') {
      if (!canEdit(u)) return send(res, 403, { error: 'Viewing access only' });
      const id = pathname.split('/').pop();
      const idx = db.medications.findIndex(x => x.id === id);
      if (idx === -1) return send(res, 404, { error: 'Not found' });
      const removed = db.medications.splice(idx, 1)[0];
      save();
      return send(res, 200, { ok: true, removed });
    }

    if (pathname === '/api/appointments' && req.method === 'POST') {
      if (!canEdit(u)) return send(res, 403, { error: 'Viewing access only' });
      const b = await parseBody(req);
      if (!clean(b.title) || !isDate(b.date) || !isTime(b.time)) {
        return send(res, 400, { error: 'Valid title, date and time required' });
      }
      const a = {
        id: uid(),
        title: clean(b.title),
        date: b.date,
        time: b.time,
        location: clean(b.location),
        notes: clean(b.notes)
      };
      db.appointments.push(a);
      save();
      return send(res, 201, a);
    }

    if (pathname.startsWith('/api/appointments/') && req.method === 'DELETE') {
      if (!canEdit(u)) return send(res, 403, { error: 'Viewing access only' });
      const id = pathname.split('/').pop();
      const idx = db.appointments.findIndex(x => x.id === id);
      if (idx === -1) return send(res, 404, { error: 'Not found' });
      const removed = db.appointments.splice(idx, 1)[0];
      save();
      return send(res, 200, { ok: true, removed });
    }

    if (pathname === '/api/adherence' && req.method === 'POST') {
      if (!canEdit(u)) return send(res, 403, { error: 'Viewing access only' });
      const b = await parseBody(req);
      const m = db.medications.find(x => x.id === b.medicationId);
      if (!m || !['taken', 'missed'].includes(b.status)) return send(res, 400, { error: 'Invalid entry' });
      const date = isDate(b.date) ? b.date : getToday();
      if (db.logs.some(x => x.medicationId === m.id && x.date === date)) {
        return send(res, 409, { error: 'Already recorded today' });
      }
      const l = {
        id: uid(),
        medicationId: m.id,
        medication: m.name,
        status: b.status,
        date,
        by: u.id,
        at: new Date().toISOString()
      };
      db.logs.push(l);
      save();
      return send(res, 201, l);
    }

    if (pathname === '/api/reminders' && req.method === 'POST') {
      if (!canEdit(u)) return send(res, 403, { error: 'Viewing access only' });
      return send(res, 200, await runReminders());
    }

    if (pathname === '/api/ai-signals' && req.method === 'GET') {
      const signals = db.medications.filter(m => m.active).map(m => {
        const logs = db.logs.filter(x => x.medicationId === m.id);
        const taken = logs.filter(x => x.status === 'taken').length;
        const missed = logs.filter(x => x.status === 'missed').length;
        return {
          medicationId: m.id,
          name: m.name,
          ...predict({
            time: m.time,
            taken,
            missed,
            recentMiss: logs.at(-1)?.status === 'missed'
          })
        };
      });
      return send(res, 200, {
        signals,
        disclaimer: 'Experimental ML trained only on synthetic data. Non-clinical follow-up cues only; not for medical diagnoses, prescribing, or clinical decisions.'
      });
    }

    if (pathname === '/api/report' && req.method === 'GET') {
      return send(res, 200, {
        platform: 'AVIRA CareCircle',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        summary: summary(),
        adherence: db.logs,
        alerts: db.alerts,
        appointments: db.appointments,
        preferences: db.preferences,
        disclaimer: 'Synthetic demonstration data for Catalyst 2026 challenge. Not for real medical decisions.'
      });
    }

    return send(res, 404, { error: 'Unknown endpoint' });
  }

  // Static files serving
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  let file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!['index.html', 'app.js', 'style.css'].includes(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }

  const ext = path.extname(file);
  const contentType = ext === '.js'
    ? 'application/javascript; charset=utf-8'
    : ext === '.css'
      ? 'text/css; charset=utf-8'
      : 'text/html; charset=utf-8';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });
  fs.createReadStream(path.join(__dirname, 'public', file)).pipe(res);
}

const server = http.createServer((req, res) => {
  Promise.resolve(handler(req, res)).catch(e => send(res, 400, { error: e.message || 'Request error' }));
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`AVIRA CareCircle http://localhost:${PORT} (demo only)`));
  setInterval(() => runReminders().catch(() => {}), 60000).unref();
}

module.exports = {
  server,
  handler,
  due,
  summary,
  runReminders,
  seed,
  getToday,
  resetDb: () => { db = structuredClone(seed); }
};
