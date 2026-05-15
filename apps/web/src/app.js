const PATIENT_KEY = 'careclaw_patient_state';
const PATIENT_TOKEN_KEY = 'careclaw_patient_token';
const DOCTOR_KEY = 'careclaw_doctor_token';
const isDoctorMode = window.location.pathname.startsWith('/doctor') || new URLSearchParams(window.location.search).has('doctor');

const defaultState = {
  guestId: `guest-${crypto.randomUUID()}`,
  activeTab: 'chat',
  stage: 'guest',
  messages: [],
  intakeSessionId: null,
  intakeReadyForPayment: false,
  paymentSessionId: null,
  payment: null,
  consultationId: null,
  user: null,
  history: null,
  lastUpdated: null
};

let state = loadPatientState();
let paymentPoll = null;
let consultationPoll = null;
let activeDoctorCase = null;

const pageTitle = document.querySelector('#pageTitle');
const stagePill = document.querySelector('#stagePill');
const sceneTitle = document.querySelector('#sceneTitle');
const sceneText = document.querySelector('#sceneText');
const chatLog = document.querySelector('#chatLog');
const patientMessage = document.querySelector('#patientMessage');
const quickChoices = document.querySelector('#quickChoices');
const paymentChoices = document.querySelector('#paymentChoices');
const paymentResult = document.querySelector('#paymentResult');
const createPayment = document.querySelector('#createPayment');
const patientPanel = document.querySelector('#patientPanel');
const patientNav = document.querySelector('#patientNav');
const doctorPanel = document.querySelector('#doctorPanel');
const doctorLoginPanel = document.querySelector('#doctorLoginPanel');
const doctorWorkspace = document.querySelector('#doctorWorkspace');
const doctorQueue = document.querySelector('#doctorQueue');
const doctorCase = document.querySelector('#doctorCase');
const doctorSummary = document.querySelector('#doctorSummary');
const doctorChatLog = document.querySelector('#doctorChatLog');
const doctorSuggestions = document.querySelector('#doctorSuggestions');
const doctorMessage = document.querySelector('#doctorMessage');
const doctorPatientState = document.querySelector('#doctorPatientState');
const accountCard = document.querySelector('#accountCard');
const authForms = document.querySelector('#authForms');
const loginForm = document.querySelector('#loginForm');
const registerForm = document.querySelector('#registerForm');
const historyGate = document.querySelector('#historyGate');
const historyList = document.querySelector('#historyList');

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
  document.cookie = `careclaw_guest=${state.guestId}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

function patientHeaders() {
  const token = localStorage.getItem(PATIENT_TOKEN_KEY);
  return token ? { authorization: `Bearer ${token}` } : {};
}

function doctorHeaders() {
  const token = localStorage.getItem(DOCTOR_KEY);
  return token ? { authorization: `Bearer ${token}` } : {};
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

function setScene(title, text) {
  sceneTitle.textContent = title;
  sceneText.textContent = text;
}

function setStage(stage) {
  state.stage = stage;
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

function restorePatientChat() {
  chatLog.innerHTML = '';
  state.messages.forEach((message) => addChatMessage(message.role, message.text, false));
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

function renderChips(target, choices = [], handler) {
  target.innerHTML = '';
  if (!choices.length) {
    target.classList.add('hidden');
    return;
  }
  choices.slice(0, 8).forEach((choice) => {
    const label = typeof choice === 'string' ? choice : choice.label;
    const value = typeof choice === 'string' ? choice : choice.value;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-chip secondary';
    button.textContent = label;
    button.addEventListener('click', () => handler(value));
    target.appendChild(button);
  });
  target.classList.remove('hidden');
}

function renderPaymentResult(payment) {
  if (!payment) return;
  const details = [
    `<strong>${payment.method === 'qris' || payment.method === 'QRIS' ? 'QRIS' : 'Virtual Account'}</strong>`,
    `${payment.currency || 'IDR'} ${Number(payment.amount || 0).toLocaleString('id-ID')}`
  ];
  if (payment.va_number) details.push(`${payment.bank}: ${payment.va_number}`);
  if (payment.payment_url) details.push(`<a href="${payment.payment_url}" target="_blank" rel="noreferrer">Buka link</a>`);
  if (payment.qr_image_url) details.push(`<a href="${payment.qr_image_url}" target="_blank" rel="noreferrer">Buka QR</a>`);
  paymentResult.innerHTML = details.map((item) => `<p>${item}</p>`).join('');
  paymentResult.classList.remove('hidden');
}

async function startIntakeIfNeeded() {
  if (state.intakeSessionId) return;
  const start = await api('/intake/start', {
    method: 'POST',
    headers: patientHeaders(),
    body: JSON.stringify({ guest_id: state.guestId })
  });
  state.intakeSessionId = start.session_id;
  addChatMessage('agent', start.reply);
  savePatientState();
}

async function sendPatientMessage() {
  const message = patientMessage.value.trim();
  if (!message) return;

  if (state.consultationId && ['doctor', 'done'].includes(state.stage)) {
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
  renderChips(quickChoices, [], () => {});

  const intake = await api('/intake/message', {
    method: 'POST',
    body: JSON.stringify({ session_id: state.intakeSessionId, message })
  });
  addChatMessage('agent', intake.reply);
  renderChips(quickChoices, intake.choices || [], (value) => {
    patientMessage.value = value;
    patientMessage.focus();
  });

  if (intake.ready_for_payment) {
    state.intakeReadyForPayment = true;
    setStage('pay');
    setScene('Siap bayar', 'Setelah bayar, Anda masuk antrean dokter.');
  } else {
    setStage('chat');
    setScene('Lanjut jawab', 'Satu pertanyaan dulu agar tetap mudah.');
  }
}

async function createPaymentSession() {
  if (!state.intakeReadyForPayment) return;
  const payment = await api('/payment/chat/start', {
    method: 'POST',
    headers: patientHeaders(),
    body: JSON.stringify({ intake_session_id: state.intakeSessionId, guest_id: state.guestId })
  });
  state.paymentSessionId = payment.session_id;
  savePatientState();
  setScene('Pilih pembayaran', 'Pilih cara bayar yang paling mudah.');
  renderChips(paymentChoices, payment.choices || [], sendPaymentMessage);
  renderPatient();
}

async function sendPaymentMessage(message) {
  if (!state.paymentSessionId) return;
  const payment = await api('/payment/chat/message', {
    method: 'POST',
    body: JSON.stringify({ session_id: state.paymentSessionId, message })
  });
  renderChips(paymentChoices, payment.choices || [], sendPaymentMessage);
  if (payment.reply) addChatMessage('agent', payment.reply);
  if (payment.payment) {
    state.payment = payment.payment;
    setStage('waiting');
    renderPaymentResult(payment.payment);
    setScene('Menunggu dokter', 'Kami cek pembayaran otomatis.');
    startPaymentPolling();
  }
}

function startPaymentPolling() {
  if (paymentPoll || !state.paymentSessionId) return;
  paymentPoll = window.setInterval(async () => {
    const status = await api(`/payment/chat/status/${state.paymentSessionId}`);
    if (status.consultation_id) state.consultationId = status.consultation_id;
    if (status.status === 'paid' || status.consultation_unlocked) {
      window.clearInterval(paymentPoll);
      paymentPoll = null;
      setStage('doctor');
      setScene('Dokter segera masuk', 'Tetap di chat ini untuk lanjut.');
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
    if (consultation.status === 'final_ready' || consultation.status === 'completed') setStage('done');
  }, 6000);
}

function renderPatientConsultation(consultation) {
  state.messages = consultation.messages.map((message) => ({
    role: message.role === 'doctor' ? 'doctor' : message.role === 'patient' ? 'patient' : 'agent',
    text: message.content,
    at: message.at
  }));
  savePatientState();
  restorePatientChat();
  if (consultation.status === 'waiting_doctor') setScene('Menunggu dokter', 'Dokter akan mengambil antrean.');
  if (consultation.status === 'active') setScene('Dokter sudah masuk', 'Lanjut chat di sini.');
  if (consultation.status === 'final_ready' || consultation.status === 'completed') setScene('Selesai', 'Masuk untuk melihat riwayat.');
  renderPatient();
}

function switchTab(tab) {
  state.activeTab = tab;
  savePatientState();
  document.querySelectorAll('[data-tab-view]').forEach((view) => {
    view.classList.toggle('hidden', view.dataset.tabView !== tab);
  });
  patientNav.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  pageTitle.textContent = tab === 'chat' ? 'Ceritakan keluhan' : tab === 'doctor' ? 'Dokter' : tab === 'history' ? 'Riwayat' : 'Akun';
  if (tab === 'history') loadHistory().catch(showError);
  renderPatient();
}

function renderDoctorPatientState() {
  if (state.stage === 'doctor') {
    doctorPatientState.innerHTML = '<strong>Menunggu dokter</strong><span>Anda akan lanjut chat di tab Chat.</span>';
  } else if (state.stage === 'done') {
    doctorPatientState.innerHTML = '<strong>Konsultasi selesai</strong><span>Login untuk menyimpan dan melihat riwayat.</span>';
  } else {
    doctorPatientState.innerHTML = '<strong>Belum ada dokter</strong><span>Selesaikan chat awal dan pembayaran dulu.</span>';
  }
}

function renderAccount() {
  if (state.user) {
    accountCard.innerHTML = `<strong>${state.user.email}</strong><span>Riwayat Anda tersimpan di akun ini.</span><button id="patientLogout" type="button" class="secondary">Keluar</button>`;
    authForms.classList.add('hidden');
    document.querySelector('#patientLogout').addEventListener('click', () => {
      localStorage.removeItem(PATIENT_TOKEN_KEY);
      state.user = null;
      state.history = null;
      savePatientState();
      renderPatient();
    });
  } else {
    accountCard.innerHTML = '<strong>Masih sebagai tamu</strong><span>Tamu hanya bisa punya satu konsultasi awal. Daftar untuk riwayat dan konsultasi berikutnya.</span>';
    authForms.classList.remove('hidden');
  }
}

function renderHistory() {
  if (!state.user) {
    historyGate.classList.remove('hidden');
    historyList.classList.add('hidden');
    return;
  }
  historyGate.classList.add('hidden');
  historyList.classList.remove('hidden');
  const history = state.history || { intake: [], payments: [], consultations: [] };
  const items = [
    ...history.consultations.map((item) => ({ type: 'Dokter', ...item })),
    ...history.payments.map((item) => ({ type: 'Bayar', ...item })),
    ...history.intake.map((item) => ({ type: 'Chat', ...item }))
  ].sort((a, b) => Date.parse(b.updated_at || b.created_at || 0) - Date.parse(a.updated_at || a.created_at || 0));
  historyList.innerHTML = items.length
    ? items.map((item) => `<div class="history-item"><strong>${item.type}</strong><span>${item.status || 'tersimpan'}</span><span>${item.title || item.invoice_id || item.id}</span></div>`).join('')
    : '<div class="empty-state"><strong>Belum ada riwayat</strong><span>Riwayat muncul setelah Anda mulai konsultasi.</span></div>';
}

function renderPatient() {
  const signedIn = Boolean(state.user);
  stagePill.textContent = signedIn ? 'Akun' : 'Tamu';
  createPayment.classList.toggle('hidden', !state.intakeReadyForPayment || ['waiting', 'doctor', 'done'].includes(state.stage));
  if (state.payment) renderPaymentResult(state.payment);
  renderDoctorPatientState();
  renderAccount();
  renderHistory();
}

async function loadMe() {
  const token = localStorage.getItem(PATIENT_TOKEN_KEY);
  if (!token) return;
  try {
    const me = await api('/auth/me', { headers: patientHeaders() });
    state.user = me.user;
    state.history = me.history;
    savePatientState();
  } catch {
    localStorage.removeItem(PATIENT_TOKEN_KEY);
  }
}

async function loadHistory() {
  if (!state.user) {
    renderHistory();
    return;
  }
  state.history = await api('/history', { headers: patientHeaders() });
  savePatientState();
  renderHistory();
}

async function patientLogin() {
  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: document.querySelector('#loginEmail').value,
      password: document.querySelector('#loginPassword').value
    })
  });
  localStorage.setItem(PATIENT_TOKEN_KEY, login.token);
  state.user = login.user;
  state.history = login.history;
  savePatientState();
  switchTab('history');
}

async function patientRegister() {
  const register = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: document.querySelector('#registerEmail').value,
      password: document.querySelector('#registerPassword').value,
      confirm_password: document.querySelector('#registerConfirm').value,
      guest_id: state.guestId
    })
  });
  localStorage.setItem(PATIENT_TOKEN_KEY, register.token);
  state.user = register.user;
  state.history = register.history;
  savePatientState();
  switchTab('history');
}

function showError(error) {
  setScene('Perlu dicek', error.message);
}

async function doctorLogin() {
  const login = await api('/login', {
    method: 'POST',
    body: JSON.stringify({
      username: document.querySelector('#doctorUser').value.trim(),
      password: document.querySelector('#doctorPass').value
    })
  });
  localStorage.setItem(DOCTOR_KEY, login.token);
  showDoctorWorkspace();
  await loadDoctorQueue();
}

function showDoctorWorkspace() {
  doctorLoginPanel.classList.add('hidden');
  doctorWorkspace.classList.remove('hidden');
  setScene('Ruang dokter', 'Ambil pasien yang sudah selesai bayar.');
  stagePill.textContent = 'Dokter';
}

async function loadDoctorQueue() {
  const data = await api('/doctor/queue', { headers: doctorHeaders() });
  doctorQueue.innerHTML = data.consultations.length ? '' : '<div class="doctor-summary">Belum ada pasien menunggu.</div>';
  data.consultations.forEach((consultation) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'queue-item';
    button.innerHTML = `<strong>${consultation.patient_name}</strong><span>${consultation.status}</span><span>${consultation.patient_summary || 'Ringkasan tersedia setelah chat awal.'}</span>`;
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
    `<strong>Biaya:</strong> ${consultation.payment?.currency || 'IDR'} ${Number(consultation.payment?.amount || 0).toLocaleString('id-ID')}`,
    `<strong>Ringkas:</strong> ${consultation.patient_summary || 'Belum ada ringkasan.'}`
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
  setScene('Selesai', 'Hasil sudah disiapkan.');
}

function bootPatient() {
  patientPanel.classList.remove('hidden');
  doctorPanel.classList.add('hidden');
  patientNav.classList.remove('hidden');
  restorePatientChat();
  switchTab(state.activeTab || 'chat');
  if (state.paymentSessionId && state.stage === 'waiting') startPaymentPolling();
  if (state.consultationId && ['doctor', 'done'].includes(state.stage)) startConsultationPolling();
}

function bootDoctor() {
  patientPanel.classList.add('hidden');
  patientNav.classList.add('hidden');
  doctorPanel.classList.remove('hidden');
  if (localStorage.getItem(DOCTOR_KEY)) {
    showDoctorWorkspace();
    loadDoctorQueue().catch((error) => {
      localStorage.removeItem(DOCTOR_KEY);
      doctorLoginPanel.classList.remove('hidden');
      doctorWorkspace.classList.add('hidden');
      showError(error);
    });
  } else {
    setScene('Ruang dokter', 'Masuk untuk melayani pasien.');
    stagePill.textContent = 'Dokter';
  }
}

patientNav.querySelectorAll('button').forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.tab));
});

document.querySelector('#startConsultation').addEventListener('click', () => sendPatientMessage().catch(showError));
document.querySelector('#createPayment').addEventListener('click', () => createPaymentSession().catch(showError));
document.querySelector('#mockVoice').addEventListener('click', () => {
  patientMessage.value = 'Saya demam dan batuk sejak 3 hari, badan lemas, tidak sesak.';
  setScene('Voice siap', 'Kirim kalau transkrip sudah benar.');
});

patientMessage.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendPatientMessage().catch(showError);
  }
});

document.querySelector('#showLogin').addEventListener('click', () => {
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  document.querySelector('#showLogin').classList.add('active');
  document.querySelector('#showRegister').classList.remove('active');
});

document.querySelector('#showRegister').addEventListener('click', () => {
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
  document.querySelector('#showLogin').classList.remove('active');
  document.querySelector('#showRegister').classList.add('active');
});

document.querySelector('#patientLogin').addEventListener('click', () => patientLogin().catch(showError));
document.querySelector('#patientRegister').addEventListener('click', () => patientRegister().catch(showError));
document.querySelector('#doctorLogin').addEventListener('click', () => doctorLogin().catch(showError));
document.querySelector('#refreshQueue').addEventListener('click', () => loadDoctorQueue().catch(showError));
document.querySelector('#sendDoctorMessage').addEventListener('click', () => sendDoctorMessage().catch(showError));
document.querySelector('#endConsultation').addEventListener('click', () => endConsultation().catch(showError));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}

await loadMe();
if (isDoctorMode) bootDoctor();
else bootPatient();
