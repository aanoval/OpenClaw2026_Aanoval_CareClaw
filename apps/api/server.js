import http from 'node:http';
import { randomUUID } from 'node:crypto';

const host = process.env.API_HOST || '127.0.0.1';
const port = Number(process.env.API_PORT || 8050);

const doctorLogin = {
  username: process.env.DOCTOR_USERNAME || 'doctor',
  password: process.env.DOCTOR_PASSWORD || 'careclaw2026'
};

const intakeSessions = new Map();
const aiConfig = {
  apiKey: process.env.SUMOPOD_API_KEY || process.env.OPENAI_API_KEY || '',
  baseUrl: process.env.SUMOPOD_BASE_URL || process.env.OPENAI_BASE_URL || 'https://ai.sumopod.com/v1',
  model: process.env.SUMOPOD_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini'
};

const intakeSystemPrompt = `You are the CareClaw Initial Patient Agent.

Your job is proactive medical anamnesis for an online doctor consultation.
You are not a doctor and must not diagnose or prescribe.

Ask one concise follow-up question at a time until the consultation is ready for payment/doctor chat.
Collect:
- chief complaint
- onset and duration
- symptom details
- severity
- associated symptoms
- red flags
- allergies
- current medication
- pregnancy status when relevant
- chronic disease history
- age range if not known

Respond in the same language the patient uses.
Return strict JSON only:
{
  "reply": "patient-facing assistant message",
  "ready_for_payment": false,
  "missing_fields": ["duration"],
  "collected": {
    "chief_complaint": "",
    "duration": "",
    "severity": "",
    "associated_symptoms": [],
    "red_flags": [],
    "allergies": "",
    "current_medication": "",
    "chronic_history": ""
  }
}`;

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

function absoluteUrl(req, path) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = typeof forwardedProto === 'string' ? forwardedProto : 'https';
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || 'webdr.id';
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  return `${proto}://${host}${path}`;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(payload);
}

function fallbackIntakeReply(session, message) {
  const lower = message.toLowerCase();
  const missing = [];
  if (!/\d+\s*(hari|day|days|jam|hour|hours|minggu|week|weeks)/i.test(message)) missing.push('duration');
  if (!/(nyeri dada|sesak|shortness|breath|chest pain|pingsan|confusion)/i.test(message)) missing.push('red_flags');
  if (!/(alergi|allerg)/i.test(message)) missing.push('allergies');
  if (!/(obat|medicine|medication|paracetamol|ibuprofen)/i.test(message)) missing.push('current_medication');
  const ready = session.messages.filter((item) => item.role === 'user').length >= 3 || missing.length <= 1;
  return {
    reply: ready
      ? 'Terima kasih. Informasi awal sudah cukup untuk membuat link pembayaran dan masuk antrean chat dokter.'
      : lower.includes('demam') || lower.includes('fever')
        ? 'Sejak kapan demamnya, berapa suhu tertinggi, dan apakah ada batuk, sesak napas, nyeri dada, atau lemas berat?'
        : 'Boleh ceritakan sejak kapan keluhan ini mulai, seberapa berat, dan apakah ada gejala bahaya seperti sesak napas, nyeri dada, pingsan, atau kebingungan?',
    ready_for_payment: ready,
    missing_fields: ready ? [] : missing.slice(0, 3),
    collected: {
      chief_complaint: message,
      duration: '',
      severity: '',
      associated_symptoms: [],
      red_flags: [],
      allergies: '',
      current_medication: '',
      chronic_history: ''
    },
    source: 'fallback'
  };
}

async function runIntakeAi(session, message) {
  if (!aiConfig.apiKey) return fallbackIntakeReply(session, message);

  const response = await fetch(`${aiConfig.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${aiConfig.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: aiConfig.model,
      temperature: 0.35,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: intakeSystemPrompt },
        ...session.messages.slice(-12)
      ]
    })
  });

  if (!response.ok) {
    return fallbackIntakeReply(session, message);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return fallbackIntakeReply(session, message);

  try {
    return { ...JSON.parse(content), source: 'sumopod' };
  } catch {
    return fallbackIntakeReply(session, message);
  }
}

function createIntakeSession() {
  const id = `intake-${randomUUID()}`;
  const session = {
    id,
    messages: [],
    ready_for_payment: false,
    collected: {},
    created_at: new Date().toISOString()
  };
  intakeSessions.set(id, session);
  return session;
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

    if (req.method === 'POST' && url.pathname === '/intake/start') {
      const session = createIntakeSession();
      const reply = 'Halo, saya asisten intake CareClaw. Ceritakan keluhan utama Anda, sejak kapan mulai, dan gejala yang paling mengganggu.';
      session.messages.push({ role: 'assistant', content: reply });
      sendJson(res, 200, {
        session_id: session.id,
        reply,
        ready_for_payment: false,
        missing_fields: ['chief_complaint', 'duration', 'severity'],
        collected: session.collected
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/intake/message') {
      const body = await readBody(req);
      const sessionId = String(body.session_id || '');
      const message = String(body.message || '').trim();
      const session = intakeSessions.get(sessionId);
      if (!session) {
        sendJson(res, 404, { error: 'Intake session not found' });
        return;
      }
      if (!message) {
        sendJson(res, 400, { error: 'Message is required' });
        return;
      }
      session.messages.push({ role: 'user', content: message });
      const result = await runIntakeAi(session, message);
      session.ready_for_payment = Boolean(result.ready_for_payment);
      session.collected = result.collected || session.collected;
      session.messages.push({ role: 'assistant', content: result.reply });
      sendJson(res, 200, {
        session_id: session.id,
        reply: result.reply,
        ready_for_payment: session.ready_for_payment,
        missing_fields: result.missing_fields || [],
        collected: session.collected,
        source: result.source || 'agent'
      });
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/intake/status/')) {
      const sessionId = url.pathname.split('/').pop() || '';
      const session = intakeSessions.get(sessionId);
      if (!session) {
        sendJson(res, 404, { error: 'Intake session not found' });
        return;
      }
      sendJson(res, 200, session);
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
      const invoiceId = `DOKU-DEMO-${Date.now()}`;
      sendJson(res, 200, {
        invoice_id: invoiceId,
        provider: 'DOKU MCP demo',
        status: 'payment_link_created',
        payment_url: absoluteUrl(req, `/api/payment/demo/${invoiceId}`),
        consultation_unlocked: false,
        patient_state: 'waiting_for_payment_then_doctor_chat',
        next_event: 'consultation.payment_link.created'
      });
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/payment/demo/')) {
      const invoiceId = url.pathname.split('/').pop() || 'DOKU-DEMO';
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store'
      });
      res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DOKU Demo Payment</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, system-ui, sans-serif; background: #fff4df; color: #17211b; }
      main { width: min(92vw, 420px); border: 1px solid #1d2b2222; border-radius: 18px; padding: 24px; background: white; box-shadow: 0 20px 70px #17211b22; }
      h1 { margin: 0 0 8px; font-size: 24px; }
      p { line-height: 1.5; }
      .invoice { padding: 12px; border-radius: 12px; background: #f4f7f0; font-weight: 700; }
      a { display: inline-flex; margin-top: 14px; color: #0c6f55; font-weight: 800; }
    </style>
  </head>
  <body>
    <main>
      <h1>DOKU Demo Payment Link</h1>
      <p>This public demo shows the DOKU payment handoff point. Real payment credentials are configured outside the public repository.</p>
      <p class="invoice">${invoiceId}</p>
      <p>After payment verification, CareClaw routes the patient to the doctor chat queue.</p>
      <a href="/">Back to CareClaw</a>
    </main>
  </body>
</html>`);
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
