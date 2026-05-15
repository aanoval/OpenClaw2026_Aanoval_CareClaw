const steps = ['intake', 'payment', 'waiting', 'doctor', 'result'];
const PATIENT_KEY = 'careclaw_patient_state';
const DOCTOR_KEY = 'careclaw_doctor_token';
const isDoctorMode = window.location.pathname.startsWith('/doctor') || new URLSearchParams(window.location.search).has('doctor');

const defaultState = {
  stage: 'intake',
  completed: [],
  messages: [],
  intakeSessionId: null,
  intakeReadyForPayment: false,
  paymentSessionId: null,
  payment: null,
  consultationId: null,
  lastUpdated: null
};

let state = loadPatientState();
let paymentPoll = null;
let consultationPoll = null;
let activeDoctorCase = null;

const timeline = document.querySelector('#timeline');
const stagePill = document.querySelector('#stagePill');
const sceneTitle = document.querySelector('#sceneTitle');
const sceneText = document.querySelector('#sceneText');
const briefText = document.querySelector('#briefText');
const paymentChoices = document.querySelector('#paymentChoices');
const paymentResult = document.querySelector('#paymentResult');
const queueText = document.querySelector('#queueText');
const chatLog = document.querySelector('#chatLog');
const createPayment = document.querySelector('#createPayment');
const patientMessage = document.querySelector('#patientMessage');
const quickChoices = document.querySelector('#quickChoices');
const patientPanel = document.querySelector('#patientPanel');
const doctorPanel = document.querySelector('#doctorPanel');
const doctorLoginPanel = document.querySelector('#doctorLoginPanel');
const doctorWorkspace = document.querySelector('#doctorWorkspace');
const doctorQueue = document.querySelector('#doctorQueue');
const doctorCase = document.querySelector('#doctorCase');
const doctorSummary = document.querySelector('#doctorSummary');
const doctorChatLog = document.querySelector('#doctorChatLog');
const doctorSuggestions = document.querySelector('#doctorSuggestions');
const doctorMessage = document.querySelector('#doctorMessage');

function loadPatientState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(PATIENT_KEY) || '{}') };
  } catch {
    return { ...defaultState };
  }
}

function savePatientState() {
  state.lastUpdated = new Date().toISOString();
  localStorage.setItem(PATIENT_KEY, JSON.stringify(state));
  document.cookie = `careclaw_patient_stage=${state.stage}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `API ${path} failed`);
  }
  return response.json();
}

function doctorHeaders() {
  const token = localStorage.getItem(DOCTOR_KEY);
  return token ? { authorization: `Bearer ${token}` } : {};
}

function setScene(title, text) {
  sceneTitle.textContent = title;
  sceneText.textContent = text;
}

function renderTimeline() {
  timeline.innerHTML = steps
    .map((step) => `<span class="chip ${state.completed.includes(step) ? 'done' : ''}">${step}</span>`)
    .join('');
}

function setStage(stage, completed = state.completed) {
  state.stage = stage;
  state.completed = Array.from(new Set(completed));
  savePatientState();
  renderPatient();
}

function addChatMessage(role, text, persist = true) {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
  if (persist) {
    state.messages.push({ role, text, at: new Date().toISOString() });
    savePatientState();
  }
}

function renderConversation(target, messages = []) {
  target.innerHTML = '';
  messages.forEach((message) => {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${message.role}`;
    bubble.textContent = message.content || message.text || '';
    target.appendChild(bubble);
  });
  target.scrollTop = target.scrollHeight;
}

function restorePatientChat() {
  chatLog.innerHTML = '';
  state.messages.forEach((message) => addChatMessage(message.role, message.text, false));
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
    `<strong>${payment.method === 'qris' || payment.method === 'QRIS' ? 'QRIS' : 'Virtual Account'}</strong>`,
    `Nominal: ${payment.currency || 'IDR'} ${Number(payment.amount || 0).toLocaleString('id-ID')}`
  ];
  if (payment.va_number) details.push(`Nomor VA ${payment.bank}: ${payment.va_number}`);
  if (payment.payment_url) details.push(`<a href="${payment.payment_url}" target="_blank" rel="noreferrer">Buka halaman pembayaran</a>`);
  if (payment.qr_image_url) details.push(`<a href="${payment.qr_image_url}" target="_blank" rel="noreferrer">Buka QRIS</a>`);
  paymentResult.innerHTML = details.map((item) => `<p>${item}</p>`).join('');
  paymentResult.classList.remove('hidden');
  queueText.classList.remove('hidden');
}

async function startIntakeIfNeeded() {
  if (state.intakeSessionId) return;
  const start = await api('/intake/start', { method: 'POST', body: '{}' });
  state.intakeSessionId = start.session_id;
  addChatMessage('agent', start.reply);
  savePatientState();
}

async function sendPatientMessage() {
  const message = patientMessage.value.trim();
  if (!message) return;

  if (state.consultationId && ['doctor', 'result'].includes(state.stage)) {
    addChatMessage('patient', message);
    patientMessage.value = '';
    const consultation = await api(`/patient/consultations/${state.consultationId}/message`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
    renderPatientConsultation(consultation);
    return;
  }

  await startIntakeIfNeeded();
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
    if (status.consultation_id) state.consultationId = status.consultation_id;
    if (status.status === 'paid' || status.consultation_unlocked) {
      window.clearInterval(paymentPoll);
      paymentPoll = null;
      setStage('doctor', [...state.completed, 'waiting']);
      briefText.textContent = 'Pembayaran sudah masuk. Anda masuk antrean dokter.';
      setScene('Masuk antrean dokter', 'Dokter akan meninjau ringkasan awal sebelum chat dimulai.');
      startConsultationPolling();
    }
    savePatientState();
  }, 15000);
}

function startConsultationPolling() {
  if (consultationPoll || !state.consultationId) return;
  consultationPoll = window.setInterval(async () => {
    const consultation = await api(`/patient/consultations/${state.consultationId}`);
    renderPatientConsultation(consultation);
    if (consultation.status === 'final_ready') {
      setStage('result', [...state.completed, 'doctor']);
    }
  }, 6000);
}

function renderPatientConsultation(consultation) {
  const rendered = consultation.messages.map((message) => ({
    role: message.role === 'doctor' ? 'doctor' : message.role === 'patient' ? 'patient' : 'agent',
    text: message.content,
    at: message.at
  }));
  state.messages = rendered;
  savePatientState();
  restorePatientChat();
  if (consultation.status === 'waiting_doctor') {
    briefText.textContent = 'Pembayaran terverifikasi. Menunggu dokter mengambil antrian.';
  }
  if (consultation.status === 'active') {
    briefText.textContent = 'Dokter sudah masuk. Anda bisa melanjutkan chat di sini.';
  }
  if (consultation.status === 'final_ready') {
    briefText.textContent = 'Dokter sedang menyiapkan instruksi final.';
    setScene('Instruksi final disiapkan', 'Ringkasan, edukasi, dan rencana tindak lanjut sedang dirapikan.');
  }
}

function renderPatient() {
  stagePill.textContent = state.stage.replace('_', ' ');
  renderTimeline();
  createPayment.classList.toggle('hidden', !state.intakeReadyForPayment || state.stage === 'waiting' || state.stage === 'doctor' || state.stage === 'result');
  if (state.payment) renderPaymentResult(state.payment);
}

async function createPaymentSession() {
  if (!state.intakeReadyForPayment) return;
  const payment = await api('/payment/chat/start', {
    method: 'POST',
    body: JSON.stringify({ intake_session_id: state.intakeSessionId })
  });
  state.paymentSessionId = payment.session_id;
  savePatientState();
  paymentResult.classList.add('hidden');
  briefText.textContent = payment.reply;
  renderPaymentChoices(payment.choices || []);
  setScene('Pilih metode pembayaran', 'Pembayaran diperlukan sebelum chat dokter dibuka.');
  renderPatient();
}

async function doctorLogin() {
  const username = document.querySelector('#doctorUser').value.trim();
  const password = document.querySelector('#doctorPass').value;
  const login = await api('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  localStorage.setItem(DOCTOR_KEY, login.token);
  showDoctorWorkspace();
  await loadDoctorQueue();
}

function showDoctorWorkspace() {
  doctorLoginPanel.classList.add('hidden');
  doctorWorkspace.classList.remove('hidden');
  setScene('Doctor workspace', 'Tinjau ringkasan intake, ambil antrian, lalu chat dengan pasien.');
  briefText.textContent = 'Mode dokter tersembunyi aktif. Tidak ada tombol dokter di halaman pasien.';
  stagePill.textContent = 'doctor';
}

async function loadDoctorQueue() {
  const data = await api('/doctor/queue', { headers: doctorHeaders() });
  doctorQueue.innerHTML = '';
  if (!data.consultations.length) {
    doctorQueue.innerHTML = '<div class="doctor-summary">Belum ada pasien berbayar yang menunggu dokter.</div>';
    return;
  }
  data.consultations.forEach((consultation) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'queue-item';
    button.innerHTML = `<strong>${consultation.patient_name}</strong><span>${consultation.status}</span><span>${consultation.patient_summary || 'Ringkasan intake tersedia setelah pasien menyelesaikan pembayaran.'}</span>`;
    button.addEventListener('click', () => claimDoctorCase(consultation.id));
    doctorQueue.appendChild(button);
  });
}

async function claimDoctorCase(id) {
  const consultation = await api(`/doctor/consultations/${id}/claim`, {
    method: 'POST',
    headers: doctorHeaders(),
    body: '{}'
  });
  activeDoctorCase = consultation.id;
  renderDoctorCase(consultation);
}

function renderDoctorCase(consultation) {
  doctorCase.classList.remove('hidden');
  doctorSummary.innerHTML = [
    `<strong>Status:</strong> ${consultation.status}`,
    `<strong>Payment:</strong> ${consultation.payment?.currency || 'IDR'} ${Number(consultation.payment?.amount || 0).toLocaleString('id-ID')}`,
    `<strong>Summary:</strong> ${consultation.patient_summary || 'No patient summary yet.'}`
  ].map((item) => `<p>${item}</p>`).join('');
  renderConversation(doctorChatLog, consultation.messages);
  doctorSuggestions.innerHTML = (consultation.assistant?.suggestions || [])
    .map((item) => `<div class="suggestion-item">${item}</div>`)
    .join('');
}

async function sendDoctorMessage() {
  const message = doctorMessage.value.trim();
  if (!message || !activeDoctorCase) return;
  doctorMessage.value = '';
  const consultation = await api(`/doctor/consultations/${activeDoctorCase}/message`, {
    method: 'POST',
    headers: doctorHeaders(),
    body: JSON.stringify({ message })
  });
  renderDoctorCase(consultation);
}

async function endConsultation() {
  if (!activeDoctorCase) return;
  const consultation = await api(`/doctor/consultations/${activeDoctorCase}/end`, {
    method: 'POST',
    headers: doctorHeaders(),
    body: '{}'
  });
  renderDoctorCase(consultation);
  briefText.textContent = 'Final review package sudah dibuat dan siap dikirim setelah dokter menyetujui.';
}

function bootPatient() {
  patientPanel.classList.remove('hidden');
  doctorPanel.classList.add('hidden');
  restorePatientChat();
  renderPatient();
  if (state.paymentSessionId && state.stage === 'waiting') startPaymentPolling();
  if (state.consultationId && ['doctor', 'result'].includes(state.stage)) startConsultationPolling();
}

function bootDoctor() {
  patientPanel.classList.add('hidden');
  doctorPanel.classList.remove('hidden');
  timeline.innerHTML = '';
  if (localStorage.getItem(DOCTOR_KEY)) {
    showDoctorWorkspace();
    loadDoctorQueue().catch((error) => {
      localStorage.removeItem(DOCTOR_KEY);
      doctorLoginPanel.classList.remove('hidden');
      doctorWorkspace.classList.add('hidden');
      briefText.textContent = error.message;
    });
  } else {
    setScene('Doctor workspace', 'Masuk untuk mengambil pasien yang sudah valid pembayarannya.');
    briefText.textContent = 'Akses dokter tidak ditampilkan di halaman pasien. Buka langsung melalui /doctor.';
  }
}

createPayment.addEventListener('click', () => {
  createPaymentSession().catch((error) => {
    briefText.textContent = error.message;
  });
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

document.querySelector('#doctorLogin').addEventListener('click', () => {
  doctorLogin().catch((error) => {
    briefText.textContent = error.message;
  });
});

document.querySelector('#refreshQueue').addEventListener('click', () => {
  loadDoctorQueue().catch((error) => {
    briefText.textContent = error.message;
  });
});

document.querySelector('#sendDoctorMessage').addEventListener('click', () => {
  sendDoctorMessage().catch((error) => {
    briefText.textContent = error.message;
  });
});

document.querySelector('#endConsultation').addEventListener('click', () => {
  endConsultation().catch((error) => {
    briefText.textContent = error.message;
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}

if (isDoctorMode) {
  bootDoctor();
} else {
  bootPatient();
}
