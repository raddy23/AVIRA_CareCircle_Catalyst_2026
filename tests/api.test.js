'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('stream');
const { server, due, summary, runReminders, seed, getToday, resetDb } = require('../server');

// Universal in-memory test dispatcher for resilient execution in any sandbox or CI
function call(pathname, method = 'GET', data = null, token = '') {
  return new Promise((resolve, reject) => {
    const req = new Readable({ read() {} });
    req.url = pathname;
    req.method = method;
    req.headers = { 'content-type': 'application/json' };
    if (token) req.headers['authorization'] = 'Bearer ' + token;
    if (data) {
      const payload = JSON.stringify(data);
      req.headers['content-length'] = Buffer.byteLength(payload);
      req.push(payload);
    }
    req.push(null);

    let statusCode = 200;
    let resHeaders = {};
    const chunks = [];
    const res = new Writable({
      write(chunk, enc, cb) { chunks.push(chunk); cb(); }
    });
    res.writeHead = (code, headers) => {
      statusCode = code;
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          resHeaders[k.toLowerCase()] = v;
        }
      }
    };
    res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.on('finish', () => {
      const raw = Buffer.concat(chunks).toString();
      let parsed = raw;
      try { parsed = JSON.parse(raw); } catch {}
      resolve({ status: statusCode, headers: resHeaders, data: parsed });
    });
    res.on('error', reject);
    req.on('error', reject);

    server.emit('request', req, res);
  });
}

async function login(who = 'elder', pass = '2468') {
  const res = await call('/api/login', 'POST', { user: who, passcode: pass });
  return res.data.token;
}

test.before(() => {
  resetDb();
});

test('1. health endpoint returns 200 ready and metadata', async () => {
  const res = await call('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.data.ok, true);
  assert.equal(res.data.name, 'AVIRA CareCircle');
  assert.equal(res.data.version, '1.0.0');
});

test('2. login rejects wrong passcode with 401', async () => {
  const res = await call('/api/login', 'POST', { user: 'elder', passcode: '0000' });
  assert.equal(res.status, 401);
  assert.match(res.data.error, /passcode/i);
});

test('3. protected routes require authorization token', async () => {
  const res = await call('/api/state');
  assert.equal(res.status, 401);
  assert.match(res.data.error, /Log in first/i);
});

test('4. elder signs in and views personalized schedule', async () => {
  const token = await login('elder', '2468');
  assert.ok(token, 'Should receive signed JWT/HMAC token');
  const res = await call('/api/state', 'GET', null, token);
  assert.equal(res.status, 200);
  assert.equal(res.data.user.role, 'elder');
  assert.equal(res.data.user.name, 'Anita Rao');
  assert.ok(res.data.medications.length >= 2, 'Should have baseline medications');
});

test('5. caregiver signs in and has editing permissions', async () => {
  const token = await login('carer', '1357');
  assert.ok(token);
  const state = await call('/api/state', 'GET', null, token);
  assert.equal(state.status, 200);
  assert.equal(state.data.user.role, 'carer');
});

test('6. family member is read-only and mutations return 403', async () => {
  const token = await login('family', '9876');
  const state = await call('/api/state', 'GET', null, token);
  assert.equal(state.status, 200);
  assert.equal(state.data.user.role, 'family');

  const medRes = await call('/api/medications', 'POST', { name: 'Unauthorized Med', time: '14:00' }, token);
  assert.equal(medRes.status, 403);
  assert.match(medRes.data.error, /Viewing access only/i);

  const aptRes = await call('/api/appointments', 'POST', { title: 'Unauthorized Doctor', date: '2026-11-20', time: '10:00' }, token);
  assert.equal(aptRes.status, 403);

  const adhRes = await call('/api/adherence', 'POST', { medicationId: 'm1', status: 'taken' }, token);
  assert.equal(adhRes.status, 403);
});

test('7. invalid schedule format rejected with 400', async () => {
  const token = await login('elder', '2468');
  const res = await call('/api/medications', 'POST', { name: 'Blood Pressure', time: '26:00' }, token);
  assert.equal(res.status, 400);
  assert.match(res.data.error, /time required/i);
});

test('8. medication can be created, updated via PATCH, and removed via DELETE', async () => {
  const token = await login('elder', '2468');
  const created = await call('/api/medications', 'POST', {
    name: 'Calcium + Vit D3',
    dose: '1 tablet with water',
    time: '12:00',
    notes: 'After lunch'
  }, token);
  assert.equal(created.status, 201);
  const medId = created.data.id;
  assert.ok(medId);

  // PATCH update
  const patched = await call('/api/medications/' + medId, 'PATCH', {
    notes: 'After lunch with a full glass of water',
    active: true
  }, token);
  assert.equal(patched.status, 200);
  assert.equal(patched.data.notes, 'After lunch with a full glass of water');

  // DELETE cleanup
  const deleted = await call('/api/medications/' + medId, 'DELETE', null, token);
  assert.equal(deleted.status, 200);
  assert.equal(deleted.data.ok, true);
});

test('9. appointment validation rejects malformed date', async () => {
  const token = await login('elder', '2468');
  const res = await call('/api/appointments', 'POST', { title: 'Vision Check', date: 'bad-date', time: '11:00' }, token);
  assert.equal(res.status, 400);
});

test('10. valid appointment can be created and deleted', async () => {
  const token = await login('carer', '1357');
  const created = await call('/api/appointments', 'POST', {
    title: 'Cardiology Teleconsultation',
    date: '2026-11-25',
    time: '15:30',
    location: 'Video link / Dr. Sharma',
    notes: 'Review blood pressure log'
  }, token);
  assert.equal(created.status, 201);
  const aptId = created.data.id;
  assert.ok(aptId);

  const deleted = await call('/api/appointments/' + aptId, 'DELETE', null, token);
  assert.equal(deleted.status, 200);
  assert.equal(deleted.data.ok, true);
});

test('11. adherence saved and duplicate confirmation rejected with 409', async () => {
  const token = await login('elder', '2468');
  // Use a unique date token to remain idempotent across multiple test invocations
  const uniqueDay = String(Date.now() % 28 + 1).padStart(2, '0');
  const uniqueMonth = String((Date.now() >> 8) % 12 + 1).padStart(2, '0');
  const testDate = `2095-${uniqueMonth}-${uniqueDay}`;
  const a = await call('/api/adherence', 'POST', { medicationId: 'm2', status: 'taken', date: testDate }, token);
  assert.equal(a.status, 201);
  assert.equal(a.data.status, 'taken');

  const duplicate = await call('/api/adherence', 'POST', { medicationId: 'm2', status: 'taken', date: testDate }, token);
  assert.equal(duplicate.status, 409);
  assert.match(duplicate.data.error, /Already recorded/i);
});

test('12. due reminders calculation yields upcoming notifications within lead time', () => {
  const target = new Date('2026-11-16T08:45:00Z'); // 15 mins before 09:00 UTC dose
  const dueItems = due(target);
  assert.ok(dueItems.some(x => x.medicationId === 'm1'), 'Should detect m1 upcoming dose');
});

test('13. reminders endpoint runs deduplication and logs notices', async () => {
  const token = await login('carer', '1357');
  const res = await call('/api/reminders', 'POST', null, token);
  assert.equal(res.status, 200);
  assert.ok('newAlerts' in res.data);
  assert.ok(Array.isArray(res.data.alerts));
  assert.equal(res.data.emailMode, 'preview-only');
});

test('14. ML follow-up signals include transparent synthetic disclaimer', async () => {
  const token = await login('elder', '2468');
  const res = await call('/api/ai-signals', 'GET', null, token);
  assert.equal(res.status, 200);
  assert.ok(res.data.signals.length > 0);
  assert.match(res.data.disclaimer, /synthetic/i);
  assert.match(res.data.disclaimer, /not for.*clinical/i);
  const signal = res.data.signals[0];
  assert.ok('riskScore' in signal);
  assert.ok('label' in signal);
  assert.ok('features' in signal);
});

test('15. report exposes transparent audit summary and non-medical disclaimer', async () => {
  const token = await login('elder', '2468');
  const res = await call('/api/report', 'GET', null, token);
  assert.equal(res.status, 200);
  assert.ok('summary' in res.data);
  assert.ok('adherence' in res.data);
  assert.ok('appointments' in res.data);
  assert.match(res.data.disclaimer, /demonstration.*not.*medical/i);
});

test('16. static assets serve index.html, app.js, style.css with security headers', async () => {
  const html = await call('/');
  assert.equal(html.status, 200);
  assert.match(html.headers['content-type'], /text\/html/);
  assert.ok(html.headers['content-security-policy']);

  const js = await call('/app.js');
  assert.equal(js.status, 200);
  assert.match(js.headers['content-type'], /javascript/);

  const css = await call('/style.css');
  assert.equal(css.status, 200);
  assert.match(css.headers['content-type'], /css/);

  const favicon = await call('/favicon.ico');
  assert.equal(favicon.status, 204);
});

test('17. unknown route returns 404 and invalid method returns 405', async () => {
  const notFound = await call('/api/non-existent-endpoint');
  assert.equal(notFound.status, 401); // hits auth barrier first

  const token = await login('elder', '2468');
  const apiNotFound = await call('/api/non-existent-endpoint', 'GET', null, token);
  assert.equal(apiNotFound.status, 404);

  const badMethod = await call('/index.html', 'POST');
  assert.equal(badMethod.status, 405);
});
