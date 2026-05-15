import http from 'node:http';
import { randomUUID } from 'node:crypto';

const host = process.env.API_HOST || '127.0.0.1';
const port = Number(process.env.API_PORT || 8050);

const doctorLogin = {
  username: process.env.DOCTOR_USERNAME || 'doctor',
  password: process.env.DOCTOR_PASSWORD || 'careclaw2026'
};

const demoConsultation = {
  id: 'demo-consultation-001',
  status: 'doctor_review_ready',
  patient: 'Demo Patient',
  symptoms: ['fever', 'cough'],
  duration: '3 days',
  payment: 'paid',
  brief: 'Patient reports fever and cough for three days. No breathing difficulty reported in the demo intake.',
  review: {
    soap: 'S: Fever and cough for three days. O: Demo mode has no recorded examination. A: Doctor review required. P: Provide approved instructions.',
    education: 'Rest, hydrate, monitor symptoms, and seek urgent care if breathing becomes difficult.',
    prescription: 'No autonomous prescription. Doctor approval required.'
  }
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { status: 'ok', service: 'careclaw-api' });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/login') {
      const body = await readBody(req);
      const authenticated = body.username === doctorLogin.username && body.password === doctorLogin.password;
      sendJson(res, authenticated ? 200 : 401, {
        authenticated,
        token: authenticated ? `demo-doctor-${randomUUID()}` : null,
        role: authenticated ? 'doctor' : null
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/consultation/demo') {
      sendJson(res, 200, demoConsultation);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/consultation/start') {
      const body = await readBody(req);
      sendJson(res, 200, {
        consultation_id: `consultation-${randomUUID()}`,
        status: 'intake_completed',
        message: body.message || 'Patient started consultation.',
        next_event: 'consultation.symptoms.extract.requested'
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/payment/mock') {
      sendJson(res, 200, {
        invoice_id: `INV-${Date.now()}`,
        status: 'paid',
        consultation_unlocked: true,
        next_event: 'consultation.doctor_brief.requested'
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/doctor/approve') {
      sendJson(res, 200, {
        approved: true,
        patient_delivery_allowed: true,
        next_event: 'consultation.final_delivery.requested'
      });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : 'Request failed' });
  }
});

server.listen(port, host, () => {
  console.log(`CareClaw API listening on http://${host}:${port}`);
});
