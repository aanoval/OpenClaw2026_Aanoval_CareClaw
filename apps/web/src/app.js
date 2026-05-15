const steps = ['intake', 'payment', 'waiting', 'doctor', 'result'];
const STORAGE_KEY = 'careclaw_patient_state';

const defaultState = {
  stage: 'intake',
  completed: [],
  messages: [],
  intakeSessionId: null,
  intakeReadyForPayment: false,
  paymentSessionId: null,
  payment: null,
  lastUpdated: null
};

let state = loadState();
let paymentPoll = null;

const timeline = document.querySelector('#timeline');
const stagePill = document.querySelector('#stagePill');
const sceneTitle = document.querySelector('#sceneTitle');
const sceneText = document.querySelector('#sceneText');
const briefText = document.querySelector('#briefText');
const paymentLink = document.querySelector('#paymentLink');
const paymentChoices = document.querySelector('#paymentChoices');
const paymentResult = document.querySelector('#paymentResult');
const queueText = document.querySelector('#queueText');
const chatLog = document.querySelector('#chatLog');
const createPayment = document.querySelector('#createPayment');
const patientMessage = document.querySelector('#patientMessage');
const quickChoices = document.querySelector('#quickChoices');

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  state.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  document.cookie = `careclaw_patient_stage=${state.stage}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

function addChatMessage(role, text, persist = true) {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
  if (persist) {
    state.messages.push({ role, text, at: new Date().toISOString() });
    saveState();
  }
}

function restoreChat() {
  chatLog.innerHTML = '';
  state.messages.forEach((message) => addChatMessage(message.role, message.text, false));
}

function setStage(stage, completed = state.completed) {
  state.stage = stage;
  state.completed = Array.from(new Set(completed));
  saveState();
  render();
}

function renderTimeline() {
  timeline.innerHTML = steps
    .map((step) => `<span class="chip ${state.completed.includes(step) ? 'done' : ''}">${step}</span>`)
    .join('');
}

function setScene(title, text) {
  sceneTitle.textContent = title;
  sceneText.textContent = text;
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options
  });
  if (!response.ok) throw new Error(`API ${path} failed`);
  return response.json();
}

function renderQuickChoices(choices = []) {
  quickChoices.innerHTML = '';
  if (!choices.length) {
    quickChoices.classList.add('hidden');
    return;
  }
  choices.slice(0, 4).forEach((choice) => {
    const value = typeof choice === 'string' ? choice : choice.label || choice.value;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-chip';
    button.textContent = value;
    button.addEventListener('click', () => {
      patientMessage.value = value;
      patientMessage.focus();
    });
    quickChoices.appendChild(button);
  });
  quickChoices.classList.remove('hidden');
}

function renderPaymentChoices(choices = []) {
  paymentChoices.innerHTML = '';
  if (!choices.length) {
    paymentChoices.classList.add('hidden');
    return;
  }
  choices.forEach((choice) => {
    const label = typeof choice === 'string' ? choice : choice.label;
    const value = typeof choice === 'string' ? choice : choice.value;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = label;
    button.addEventListener('click', () => sendPaymentMessage(value));
    paymentChoices.appendChild(button);
  });
  paymentChoices.classList.remove('hidden');
}

function renderPaymentResult(payment) {
  if (!payment) return;
  const details = [
    `<strong>${payment.method === 'QRIS' || payment.method === 'qris' ? 'QRIS' : 'Virtual Account'}</strong>`,
    `Nominal: ${payment.currency || 'IDR'} ${Number(payment.amount || 0).toLocaleString('id-ID')}`
  ];
  if (payment.va_number) details.push(`Nomor VA ${payment.bank}: ${payment.va_number}`);
  if (payment.payment_url) details.push(`<a href="${payment.payment_url}" target="_blank" rel="noreferrer">Buka halaman pembayaran</a>`);
  if (payment.qr_image_url) details.push(`<a href="${payment.qr_image_url}" target="_blank" rel="noreferrer">Buka QRIS</a>`);
  paymentResult.innerHTML = details.map((item) => `<p>${item}</p>`).join('');
  paymentResult.classList.remove('hidden');
  queueText.classList.remove('hidden');
}

async function sendPaymentMessage(message) {
  if (!state.paymentSessionId) return;
  const payment = await api('/payment/chat/message', {
    method: 'POST',
    body: JSON.stringify({ session_id: state.paymentSessionId, message })
  });
  briefText.textContent = payment.reply;
  renderPaymentChoices(payment.choices || []);
  if (payment.payment) {
    state.payment = payment.payment;
    state.completed = Array.from(new Set([...state.completed, 'payment']));
    setStage('waiting', state.completed);
    renderPaymentResult(payment.payment);
    setScene('Menunggu konfirmasi pembayaran', 'Setelah pembayaran masuk, Anda akan masuk antrean dokter.');
    startPaymentPolling();
  }
}

function startPaymentPolling() {
  if (paymentPoll || !state.paymentSessionId) return;
  paymentPoll = window.setInterval(async () => {
    const status = await api(`/payment/chat/status/${state.paymentSessionId}`);
    if (status.followup) briefText.textContent = status.followup;
    if (status.status === 'paid' || status.paid) {
      window.clearInterval(paymentPoll);
      paymentPoll = null;
      setStage('doctor', [...state.completed, 'waiting']);
      briefText.textContent = 'Pembayaran sudah masuk. Anda masuk antrean dokter.';
      setScene('Masuk antrean dokter', 'Dokter akan meninjau ringkasan awal sebelum chat dimulai.');
    }
  }, 15000);
}

async function startIntakeIfNeeded() {
  if (state.intakeSessionId) return;
  const start = await api('/intake/start', { method: 'POST', body: '{}' });
  state.intakeSessionId = start.session_id;
  addChatMessage('agent', start.reply);
  saveState();
}

async function sendPatientMessage() {
  await startIntakeIfNeeded();
  const message = patientMessage.value.trim();
  if (!message) return;
  addChatMessage('patient', message);
  patientMessage.value = '';
  renderQuickChoices([]);

  const intake = await api('/intake/message', {
    method: 'POST',
    body: JSON.stringify({ session_id: state.intakeSessionId, message })
  });

  addChatMessage('agent', intake.reply);
  renderQuickChoices(intake.choices || []);
  state.completed = ['intake'];
  if (intake.ready_for_payment) {
    state.intakeReadyForPayment = true;
    createPayment.classList.remove('hidden');
    briefText.textContent = 'Ringkasan awal sudah siap. Lanjutkan pembayaran agar masuk antrean dokter.';
    setStage('payment', ['intake']);
    setScene('Siap lanjut pembayaran', 'Dokter akan menerima ringkasan anamnesis yang sudah disusun.');
  } else {
    briefText.textContent = 'Saya masih melengkapi anamnesis agar dokter tidak perlu banyak mengulang pertanyaan.';
    setScene('Anamnesis berlangsung', 'Jawab pertanyaan berikutnya agar ringkasan untuk dokter makin lengkap.');
    setStage('intake', ['intake']);
  }
}

createPayment.addEventListener('click', async () => {
  if (!state.intakeReadyForPayment) return;
  const payment = await api('/payment/chat/start', {
    method: 'POST',
    body: JSON.stringify({ intake_session_id: state.intakeSessionId })
  });
  state.paymentSessionId = payment.session_id;
  saveState();
  paymentResult.classList.add('hidden');
  briefText.textContent = payment.reply;
  renderPaymentChoices(payment.choices || []);
  setScene('Pilih metode pembayaran', 'Pembayaran diperlukan sebelum chat dokter dibuka.');
  render();
});

document.querySelector('#startConsultation').addEventListener('click', () => {
  sendPatientMessage().catch((error) => {
    briefText.textContent = error.message;
  });
});

document.querySelector('#mockVoice').addEventListener('click', () => {
  patientMessage.value = 'Transkrip voice note: saya demam, batuk, dan badan lemas sejak 3 hari.';
  setScene('Voice note siap dikirim', 'Transkrip voice note bisa dikirim seperti pesan biasa.');
});

patientMessage.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendPatientMessage().catch((error) => {
      briefText.textContent = error.message;
    });
  }
});

function render() {
  stagePill.textContent = state.stage.replace('_', ' ');
  renderTimeline();
  createPayment.classList.toggle('hidden', !state.intakeReadyForPayment || state.stage === 'waiting' || state.stage === 'doctor');
  if (state.payment) renderPaymentResult(state.payment);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}

restoreChat();
render();
startIntakeIfNeeded().catch(() => {
  addChatMessage('agent', 'CareClaw sedang menyiapkan sesi konsultasi.');
});
if (state.paymentSessionId && state.stage === 'waiting') startPaymentPolling();
