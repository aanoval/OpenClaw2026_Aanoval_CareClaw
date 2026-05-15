import http from 'node:http';
import { createHash, createHmac, randomUUID } from 'node:crypto';

const host = process.env.API_HOST || '127.0.0.1';
const port = Number(process.env.API_PORT || 8050);

const doctorLogin = {
  username: process.env.DOCTOR_USERNAME || 'doctor',
  password: process.env.DOCTOR_PASSWORD || 'careclaw2026'
};

const intakeSessions = new Map();
const paymentSessions = new Map();
const consultationSessions = new Map();
const doctorTokens = new Set();
const aiConfig = {
  apiKey: process.env.SUMOPOD_API_KEY || process.env.OPENAI_API_KEY || '',
  baseUrl: process.env.SUMOPOD_BASE_URL || process.env.OPENAI_BASE_URL || 'https://ai.sumopod.com/v1',
  model: process.env.SUMOPOD_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini'
};

const dokuConfig = {
  mode: process.env.DOKU_MODE || 'sandbox',
  clientId: process.env.DOKU_CLIENT_ID || '',
  secretKey: process.env.DOKU_SECRET_KEY || '',
  merchantId: process.env.DOKU_MERCHANT_ID || '',
  baseUrl: process.env.DOKU_BASE_URL || 'https://api.doku.com',
  checkoutPath: process.env.DOKU_CHECKOUT_PATH || '/checkout/v1/payment',
  qrisPath: process.env.DOKU_QRIS_PATH || '/qris/v2/payment-code',
  vaPath: process.env.DOKU_VA_PATH || '/bank-transfer/v1/payment-code',
  statusPath: process.env.DOKU_STATUS_PATH || '/orders/v1/status',
  returnUrl: process.env.DOKU_RETURN_URL || '',
  notificationUrl: process.env.DOKU_NOTIFICATION_URL || '',
  defaultAmount: Number(process.env.DOKU_DEFAULT_AMOUNT || 25000),
  currency: process.env.DOKU_CURRENCY || 'IDR',
  simulateUntilConfigured: process.env.DOKU_SIMULATE_UNTIL_CONFIGURED !== 'false',
  followupSeconds: Number(process.env.PAYMENT_FOLLOWUP_SECONDS || 60)
};

const supportedVaBanks = ['BNI', 'BSI', 'CIMB', 'DANAMON', 'PERMATA', 'BRI', 'MANDIRI'];

const directVaChannels = {
  BNI: 'bni-virtual-account',
  BSI: 'bsm-virtual-account',
  CIMB: 'cimb-virtual-account',
  DANAMON: 'danamon-virtual-account',
  PERMATA: 'permata-virtual-account',
  BRI: 'bri-virtual-account',
  MANDIRI: 'mandiri-virtual-account'
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

function requireDoctor(req, res) {
  const header = req.headers.authorization || '';
  const token = Array.isArray(header) ? header[0] : header;
  const value = token.startsWith('Bearer ') ? token.slice(7) : '';
  if (!doctorTokens.has(value)) {
    sendJson(res, 401, { error: 'Doctor authentication required' });
    return false;
  }
  return true;
}

function createDoctorAssist(consultation, latestMessage = '') {
  const symptomText = consultation.intake_context?.chief_complaint || consultation.patient_summary || 'the patient concern';
  const suggestions = [
    'Clarify current severity and functional limitation.',
    'Confirm allergy history, current medication, and relevant chronic conditions.',
    'Check red flags before giving final home-care instructions.'
  ];
  if (/demam|fever|batuk|cough/i.test(`${symptomText} ${latestMessage}`)) {
    suggestions.unshift('Ask about temperature, breathing difficulty, chest pain, hydration, and high-risk conditions.');
  }
  return {
    suggestions: suggestions.slice(0, 3),
    draft_reply: 'Terima kasih, saya sudah membaca ringkasan awalnya. Saya akan konfirmasi beberapa hal penting sebelum memberi instruksi final.',
    safety_note: 'Doctor remains the final decision maker. AI suggestions are not sent to the patient automatically.'
  };
}

function ensureConsultationFromPayment(paymentSession) {
  if (!paymentSession.consultation_unlocked) return null;
  if (paymentSession.consultation_id) return consultationSessions.get(paymentSession.consultation_id) || null;

  const id = `consultation-${randomUUID()}`;
  const intakeSession = intakeSessions.get(paymentSession.intake_session_id || '');
  const patientMessages = intakeSession?.messages?.filter((item) => item.role === 'user').map((item) => item.content) || [];
  const consultation = {
    id,
    payment_session_id: paymentSession.id,
    intake_session_id: paymentSession.intake_session_id,
    status: 'waiting_doctor',
    patient_name: 'CareClaw Patient',
    patient_summary: patientMessages.slice(-4).join(' '),
    intake_context: paymentSession.intake_context || intakeSession?.collected || {},
    payment: {
      invoice_id: paymentSession.invoice_id,
      status: paymentSession.status,
      method: paymentSession.method,
      bank: paymentSession.bank,
      amount: paymentSession.amount,
      currency: paymentSession.currency
    },
    messages: [
      {
        role: 'system',
        content: 'Payment verified. Patient is waiting for doctor chat.',
        at: new Date().toISOString()
      }
    ],
    assistant: createDoctorAssist({ intake_context: paymentSession.intake_context || {} }),
    final_review: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  paymentSession.consultation_id = id;
  consultationSessions.set(id, consultation);
  return consultation;
}

function serializeConsultation(consultation) {
  return {
    id: consultation.id,
    status: consultation.status,
    patient_name: consultation.patient_name,
    patient_summary: consultation.patient_summary,
    intake_context: consultation.intake_context,
    payment: consultation.payment,
    messages: consultation.messages.filter((item) => item.role !== 'system'),
    assistant: consultation.assistant,
    final_review: consultation.final_review,
    created_at: consultation.created_at,
    updated_at: consultation.updated_at
  };
}

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

function normalizeIntakeResult(session, result) {
  const allText = session.messages.map((item) => item.content).join(' ').toLowerCase();
  const collected = { ...(result.collected || {}) };
  const durationMatch = allText.match(/(\d+\s*(hari|day|days|jam|hour|hours|minggu|week|weeks))/i);
  if (durationMatch && !collected.duration) collected.duration = durationMatch[1];
  if (/(tidak ada alergi|tidak alergi|no allerg|no known allerg)/i.test(allText)) collected.allergies = collected.allergies || 'none reported';
  if (/(paracetamol|ibuprofen|obat|medicine|medication)/i.test(allText)) collected.current_medication = collected.current_medication || 'reported in conversation';
  if (/(tidak punya riwayat|tidak ada riwayat|no chronic|no medical history)/i.test(allText)) collected.chronic_history = collected.chronic_history || 'none reported';
  if (/(tidak sesak|tidak nyeri dada|no shortness|no chest pain)/i.test(allText)) collected.red_flags = Array.isArray(collected.red_flags) ? collected.red_flags : [];
  if (/(ringan|mild)/i.test(allText) && !collected.severity) collected.severity = 'mild';
  if (/(sedang|moderate)/i.test(allText) && !collected.severity) collected.severity = 'moderate';
  if (/(berat|severe)/i.test(allText) && !collected.severity) collected.severity = 'severe';

  const missing = new Set(Array.isArray(result.missing_fields) ? result.missing_fields : []);
  if (collected.duration) missing.delete('duration');
  if (collected.allergies) missing.delete('allergies');
  if (collected.current_medication) missing.delete('current_medication');
  if (collected.chronic_history) missing.delete('chronic_history');
  if (collected.severity) missing.delete('severity');

  const userTurns = session.messages.filter((item) => item.role === 'user').length;
  const enoughCoreData = Boolean(collected.chief_complaint && collected.duration && collected.severity);
  const enoughSafetyData = Boolean(collected.allergies || userTurns >= 3) && Boolean(collected.current_medication || userTurns >= 3);
  const readyForPayment = Boolean(result.ready_for_payment) || (userTurns >= 3 && enoughCoreData && enoughSafetyData);

  return {
    ...result,
    collected,
    missing_fields: readyForPayment ? [] : Array.from(missing).slice(0, 4),
    ready_for_payment: readyForPayment,
    reply: readyForPayment
      ? 'Terima kasih. Informasi anamnesis awal sudah cukup. Silakan lanjut membuat link pembayaran agar Anda masuk antrean chat dokter.'
      : result.reply
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
    return normalizeIntakeResult(session, { ...JSON.parse(content), source: 'sumopod' });
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

function isDokuConfigured() {
  return Boolean(dokuConfig.clientId && dokuConfig.secretKey && dokuConfig.merchantId);
}

function dokuDigest(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('base64');
}

function dokuSignature({ method, path, requestId, timestamp, digest }) {
  const component = [
    `Client-Id:${dokuConfig.clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    `Request-Target:${path}`,
    `Digest:${digest}`
  ].join('\n');
  const signature = createHmac('sha256', dokuConfig.secretKey).update(component).digest('base64');
  return `HMACSHA256=${signature}`;
}

async function dokuPostRaw(path, payload) {
  const requestId = randomUUID();
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const digest = dokuDigest(payload);
  const response = await fetch(`${dokuConfig.baseUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'client-id': dokuConfig.clientId,
      'request-id': requestId,
      'request-timestamp': timestamp,
      'request-target': path,
      digest,
      signature: dokuSignature({ method: 'POST', path, requestId, timestamp, digest }),
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

async function dokuPost(path, payload) {
  const result = await dokuPostRaw(path, payload);
  if (!result.ok) {
    const body = result.body;
    throw new Error(body?.message || body?.error?.message || `DOKU request failed with ${result.status}`);
  }
  return result.body;
}

function directVaBody(bank, invoiceNumber, amount) {
  const base = {
    order: {
      invoice_number: invoiceNumber,
      amount
    },
    customer: {
      name: 'CareClaw Patient',
      email: 'patient@example.com'
    }
  };

  if (bank === 'BNI') {
    return {
      ...base,
      virtual_account_info: {
        expired_time: 60,
        billing_type: 'FIXED',
        info: 'CareClaw consult',
        merchant_unique_reference: `${bank}${String(Date.now()).slice(-8)}`.slice(0, 13)
      }
    };
  }

  if (bank === 'DANAMON') {
    return {
      ...base,
      order: {
        ...base.order,
        min_amount: 0,
        max_amount: 0
      },
      virtual_account_info: {
        expired_time: 60,
        reusable_status: true,
        billing_type: 'FULL_PAYMENT'
      },
      additional_info: {}
    };
  }

  if (bank === 'PERMATA') {
    return {
      ...base,
      virtual_account_info: {
        billing_type: 'FIX_BILL',
        expired_time: 60,
        reusable_status: true,
        ref_info: [
          { ref_name: 'Product', ref_value: 'CareClaw' },
          { ref_name: 'Contact', ref_value: 'webdr.id' }
        ]
      }
    };
  }

  return {
    ...base,
    virtual_account_info: {
      billing_type: 'FIX_BILL',
      expired_time: 60,
      reusable_status: false,
      info1: 'CareClaw consult',
      info2: 'webdr.id',
      info3: 'Thank you'
    }
  };
}

async function createDirectVaPayment(session, bank) {
  const channel = directVaChannels[bank];
  if (!channel) {
    return { status: 'unsupported_bank', bank };
  }
  const invoiceNumber = `CC${bank}${Date.now()}`.slice(0, 64);
  const result = await dokuPostRaw(`/${channel}/v2/payment-code`, directVaBody(bank, invoiceNumber, session.amount));
  if (!result.ok) {
    return {
      status: 'doku_error',
      bank,
      amount: session.amount,
      currency: session.currency,
      http_status: result.status,
      detail: result.body
    };
  }
  const virtualAccount = result.body?.virtual_account_info || {};
  return {
    session_id: session.id,
    invoice_id: invoiceNumber,
    provider: 'DOKU',
    mode: dokuConfig.mode,
    method: 'virtual_account',
    channel: 'direct_non_snap',
    bank,
    status: 'waiting_for_payment',
    amount: session.amount,
    currency: session.currency,
    va_number: virtualAccount.virtual_account_number || null,
    how_to_pay_page: virtualAccount.how_to_pay_page || null,
    expired_date: virtualAccount.expired_date || virtualAccount.expired_date_utc || null,
    consultation_unlocked: false
  };
}

function createPaymentSession({ intakeSessionId, amount, method }) {
  const invoiceId = `CARECLAW-${Date.now()}`;
  const intakeSession = intakeSessions.get(intakeSessionId || '');
  const session = {
    id: `payment-${randomUUID()}`,
    intake_session_id: intakeSessionId || null,
    intake_ready: Boolean(intakeSession?.ready_for_payment),
    intake_context: intakeSession?.collected || {},
    invoice_id: invoiceId,
    amount,
    currency: dokuConfig.currency,
    method,
    status: 'method_required',
    consultation_unlocked: false,
    messages: [],
    agent_events: [
      'intake.payment_handoff.received',
      'payment.method.selection.requested'
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  paymentSessions.set(session.id, session);
  return session;
}

function simulatedPaymentResult(req, session, method, bank) {
  const base = {
    session_id: session.id,
    invoice_id: session.invoice_id,
    provider: 'DOKU',
    mode: 'simulation',
    status: 'waiting_for_payment',
    amount: session.amount,
    currency: session.currency,
    consultation_unlocked: false
  };
  if (method === 'qris') {
    return {
      ...base,
      method: 'qris',
      qr_image_url: absoluteUrl(req, `/api/payment/demo/${session.invoice_id}`),
      instructions: 'Scan the QRIS code, complete payment, then CareClaw will verify before doctor chat opens.'
    };
  }
  return {
    ...base,
    method: 'virtual_account',
    bank,
    va_number: `88${String(Date.now()).slice(-10)}`,
    instructions: `Bayar Virtual Account bank ${bank} sesuai nominal. Setelah masuk, antrean dokter akan dibuka otomatis.`
  };
}

async function createDokuPayment(req, session, method, bank) {
  if (!isDokuConfigured() && dokuConfig.simulateUntilConfigured) {
    return simulatedPaymentResult(req, session, method, bank);
  }
  if (!isDokuConfigured()) {
    throw new Error('DOKU credentials are not configured');
  }

  if (method === 'virtual_account') {
    return createDirectVaPayment(session, bank);
  }

  const payload = {
    order: {
      invoice_number: session.invoice_id,
      amount: session.amount,
      currency: session.currency
    },
    payment: {
      payment_method: method === 'qris' ? 'QRIS' : 'VIRTUAL_ACCOUNT',
      payment_due_date: 60
    },
    customer: {
      name: 'CareClaw Patient'
    }
  };

  if (dokuConfig.returnUrl) payload.callback_url = dokuConfig.returnUrl;
  if (dokuConfig.notificationUrl) payload.notification_url = dokuConfig.notificationUrl;

  const path = dokuConfig.checkoutPath;
  const result = await dokuPost(path, payload);
  return {
    session_id: session.id,
    invoice_id: session.invoice_id,
    provider: 'DOKU',
    mode: dokuConfig.mode,
    method,
    bank,
    status: 'waiting_for_payment',
    amount: session.amount,
    currency: session.currency,
    consultation_unlocked: false,
    payment_url: result?.response?.payment?.url || result?.payment?.url || result?.url || null,
    qr_image_url: result?.response?.qr?.image_url || result?.qr_image_url || null,
    va_number: result?.response?.virtual_account_info?.virtual_account_number || result?.va_number || null,
    raw_status: result?.status || result?.response?.status || null
  };
}

function paymentAgentReply(session) {
  if (session.status === 'method_required') {
    return {
      reply: `Biaya konsultasinya ${session.currency} ${session.amount.toLocaleString('id-ID')}. Mau bayar pakai QRIS atau Virtual Account?`,
      choices: [
        { label: 'QRIS', value: 'qris' },
        { label: 'Virtual Account', value: 'virtual_account' }
      ]
    };
  }
  if (session.status === 'bank_required') {
    return {
      reply: 'Bisa. Mau pakai bank apa?',
      choices: supportedVaBanks.map((bank) => ({ label: bank, value: bank }))
    };
  }
  return {
    reply: 'Saya tunggu konfirmasi pembayarannya. Setelah masuk, antrean dokter akan otomatis dibuka.',
    choices: []
  };
}

async function handlePaymentChat(req, session, message) {
  const normalized = message.toLowerCase();
  if (session.status === 'method_required') {
    if (normalized.includes('qris')) {
      session.method = 'qris';
      const result = await createDokuPayment(req, session, 'qris');
      Object.assign(session, {
        status: 'waiting_for_payment',
        result,
        updated_at: new Date().toISOString()
      });
      session.agent_events.push('payment.qris.created');
      return {
        reply: 'Saya buatkan QRIS dulu. Silakan selesaikan pembayaran sesuai nominalnya.',
        payment: result,
        choices: []
      };
    }
    if (normalized.includes('virtual') || normalized.includes('va') || normalized.includes('bank')) {
      Object.assign(session, {
        method: 'virtual_account',
        status: 'bank_required',
        updated_at: new Date().toISOString()
      });
      session.agent_events.push('payment.virtual_account.bank_requested');
      return paymentAgentReply(session);
    }
  }

  if (session.status === 'bank_required') {
    const bank = supportedVaBanks.find((item) => normalized.includes(item.toLowerCase()));
    if (!bank) {
      return paymentAgentReply(session);
    }
    const result = await createDokuPayment(req, session, 'virtual_account', bank);
    Object.assign(session, {
      bank,
      status: 'waiting_for_payment',
      result,
      updated_at: new Date().toISOString()
    });
    session.agent_events.push('payment.virtual_account.created');
    return {
      reply: result.va_number
        ? `Ini nomor Virtual Account ${bank}: ${result.va_number}. Nominalnya ${result.currency} ${Number(result.amount || 0).toLocaleString('id-ID')}. Silakan bayar lewat Virtual Account bank ${bank}.`
        : `Virtual Account ${bank} sedang dibuat. Silakan lanjutkan pembayaran sesuai instruksi yang muncul.`,
      payment: result,
      choices: []
    };
  }

  return paymentAgentReply(session);
}

function maybePaymentFollowup(session) {
  if (session.status !== 'waiting_for_payment') return null;
  const lastFollowup = session.last_followup_at ? Date.parse(session.last_followup_at) : Date.parse(session.updated_at);
  const due = Date.now() - lastFollowup >= dokuConfig.followupSeconds * 1000;
  if (!due) return null;
  session.last_followup_at = new Date().toISOString();
  return 'Pembayaran belum terverifikasi. Jika sudah membayar, sistem akan membuka antrean chat dokter setelah status DOKU diterima.';
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
      const token = authenticated ? `doctor-${randomUUID()}` : null;
      if (token) doctorTokens.add(token);
      sendJson(res, authenticated ? 200 : 401, {
        authenticated,
        token,
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

    if (req.method === 'POST' && url.pathname === '/payment/chat/start') {
      const body = await readBody(req);
      const session = createPaymentSession({
        intakeSessionId: body.intake_session_id,
        amount: Number(body.amount || dokuConfig.defaultAmount),
        method: body.method || null
      });
      const agent = paymentAgentReply(session);
      session.messages.push({ role: 'agent', content: agent.reply });
      sendJson(res, 200, {
        session_id: session.id,
        invoice_id: session.invoice_id,
        status: session.status,
        amount: session.amount,
        currency: session.currency,
        ...agent
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/payment/chat/message') {
      const body = await readBody(req);
      const sessionId = String(body.session_id || '');
      const message = String(body.message || '').trim();
      const session = paymentSessions.get(sessionId);
      if (!session) {
        sendJson(res, 404, { error: 'Payment session not found' });
        return;
      }
      if (!message) {
        sendJson(res, 400, { error: 'Message is required' });
        return;
      }
      session.messages.push({ role: 'patient', content: message });
      const agent = await handlePaymentChat(req, session, message);
      session.messages.push({ role: 'agent', content: agent.reply });
      sendJson(res, 200, {
        session_id: session.id,
        invoice_id: session.invoice_id,
        status: session.status,
        ...agent
      });
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/payment/chat/status/')) {
      const sessionId = url.pathname.split('/').pop() || '';
      const session = paymentSessions.get(sessionId);
      if (!session) {
        sendJson(res, 404, { error: 'Payment session not found' });
        return;
      }
      const followup = maybePaymentFollowup(session);
      const consultation = ensureConsultationFromPayment(session);
      sendJson(res, 200, {
        session_id: session.id,
        invoice_id: session.invoice_id,
        status: session.status,
        method: session.method,
        bank: session.bank,
        payment: session.result || null,
        followup,
        agent_events: session.agent_events,
        consultation_unlocked: session.consultation_unlocked,
        consultation_id: consultation?.id || null
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/payment/doku/webhook') {
      const body = await readBody(req);
      const invoiceId = body?.order?.invoice_number || body?.invoice_number || body?.invoice_id;
      const paymentStatus = String(body?.transaction?.status || body?.status || '').toLowerCase();
      const session = Array.from(paymentSessions.values()).find((item) => item.invoice_id === invoiceId);
      if (session && ['success', 'settlement', 'paid', 'capture'].includes(paymentStatus)) {
        Object.assign(session, {
          status: 'paid',
          consultation_unlocked: true,
          updated_at: new Date().toISOString()
        });
        ensureConsultationFromPayment(session);
      }
      sendJson(res, 200, { received: true });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/doctor/queue') {
      if (!requireDoctor(req, res)) return;
      const consultations = Array.from(consultationSessions.values())
        .filter((item) => ['waiting_doctor', 'active', 'final_ready'].includes(item.status))
        .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))
        .map(serializeConsultation);
      sendJson(res, 200, { consultations });
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/doctor/consultations/')) {
      if (!requireDoctor(req, res)) return;
      const id = url.pathname.split('/').pop() || '';
      const consultation = consultationSessions.get(id);
      if (!consultation) {
        sendJson(res, 404, { error: 'Consultation not found' });
        return;
      }
      sendJson(res, 200, serializeConsultation(consultation));
      return;
    }

    if (req.method === 'POST' && url.pathname.match(/^\/doctor\/consultations\/[^/]+\/claim$/)) {
      if (!requireDoctor(req, res)) return;
      const id = url.pathname.split('/')[3] || '';
      const consultation = consultationSessions.get(id);
      if (!consultation) {
        sendJson(res, 404, { error: 'Consultation not found' });
        return;
      }
      consultation.status = 'active';
      consultation.updated_at = new Date().toISOString();
      consultation.messages.push({
        role: 'doctor',
        content: 'Halo, saya dokter yang akan meninjau konsultasi Anda. Saya sudah membaca ringkasan awalnya.',
        at: consultation.updated_at
      });
      consultation.assistant = createDoctorAssist(consultation);
      sendJson(res, 200, serializeConsultation(consultation));
      return;
    }

    if (req.method === 'POST' && url.pathname.match(/^\/doctor\/consultations\/[^/]+\/message$/)) {
      if (!requireDoctor(req, res)) return;
      const id = url.pathname.split('/')[3] || '';
      const consultation = consultationSessions.get(id);
      const body = await readBody(req);
      const message = String(body.message || '').trim();
      if (!consultation) {
        sendJson(res, 404, { error: 'Consultation not found' });
        return;
      }
      if (!message) {
        sendJson(res, 400, { error: 'Message is required' });
        return;
      }
      consultation.status = 'active';
      consultation.messages.push({ role: 'doctor', content: message, at: new Date().toISOString() });
      consultation.assistant = createDoctorAssist(consultation, message);
      consultation.updated_at = new Date().toISOString();
      sendJson(res, 200, serializeConsultation(consultation));
      return;
    }

    if (req.method === 'POST' && url.pathname.match(/^\/doctor\/consultations\/[^/]+\/end$/)) {
      if (!requireDoctor(req, res)) return;
      const id = url.pathname.split('/')[3] || '';
      const consultation = consultationSessions.get(id);
      if (!consultation) {
        sendJson(res, 404, { error: 'Consultation not found' });
        return;
      }
      consultation.status = 'final_ready';
      consultation.final_review = {
        soap: {
          subjective: consultation.patient_summary || 'Patient completed intake and doctor chat.',
          objective: 'Remote consultation. No physical examination recorded in this demo workflow.',
          assessment: 'Doctor review completed. Final clinical assessment remains doctor-authored.',
          plan: 'Send approved education, warning signs, and follow-up instructions to the patient.'
        },
        patient_education: [
          'Ikuti instruksi dokter yang dikirim di chat.',
          'Segera cari bantuan medis bila muncul sesak, nyeri dada, penurunan kesadaran, atau keluhan memburuk.',
          'Kontrol ulang bila keluhan belum membaik sesuai arahan dokter.'
        ],
        delivery_ready: true
      };
      consultation.updated_at = new Date().toISOString();
      consultation.messages.push({
        role: 'agent',
        content: 'Final review package is ready for doctor approval and patient delivery.',
        at: consultation.updated_at
      });
      sendJson(res, 200, serializeConsultation(consultation));
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/patient/consultations/')) {
      const id = url.pathname.split('/').pop() || '';
      const consultation = consultationSessions.get(id);
      if (!consultation) {
        sendJson(res, 404, { error: 'Consultation not found' });
        return;
      }
      sendJson(res, 200, serializeConsultation(consultation));
      return;
    }

    if (req.method === 'POST' && url.pathname.match(/^\/patient\/consultations\/[^/]+\/message$/)) {
      const id = url.pathname.split('/')[3] || '';
      const consultation = consultationSessions.get(id);
      const body = await readBody(req);
      const message = String(body.message || '').trim();
      if (!consultation) {
        sendJson(res, 404, { error: 'Consultation not found' });
        return;
      }
      if (!message) {
        sendJson(res, 400, { error: 'Message is required' });
        return;
      }
      consultation.messages.push({ role: 'patient', content: message, at: new Date().toISOString() });
      consultation.assistant = createDoctorAssist(consultation, message);
      consultation.updated_at = new Date().toISOString();
      sendJson(res, 200, serializeConsultation(consultation));
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
