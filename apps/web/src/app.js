const steps = [
  'intake',
  'symptoms',
  'payment',
  'brief',
  'doctor',
  'review',
  'delivery'
];

const state = {
  role: 'patient',
  completed: []
};

const timeline = document.querySelector('#timeline');
const roleToggle = document.querySelector('#roleToggle');
const patientPanel = document.querySelector('#patientPanel');
const doctorPanel = document.querySelector('#doctorPanel');
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

let intakeSessionId = null;
let intakeReadyForPayment = false;
let paymentSessionId = null;
let paymentPoll = null;

function addChatMessage(role, text) {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
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

function renderPaymentChoices(choices = []) {
  paymentChoices.innerHTML = '';
  if (!choices.length) {
    paymentChoices.classList.add('hidden');
    return;
  }
  choices.forEach((choice) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = choice.label;
    button.addEventListener('click', () => sendPaymentMessage(choice.value));
    paymentChoices.appendChild(button);
  });
  paymentChoices.classList.remove('hidden');
}

function renderPaymentResult(payment) {
  if (!payment) return;
  const details = [
    `<strong>${payment.method === 'qris' ? 'QRIS' : 'Virtual Account'}</strong>`,
    `Nominal: ${payment.currency} ${Number(payment.amount || 0).toLocaleString('id-ID')}`
  ];
  if (payment.va_number) details.push(`Nomor VA ${payment.bank}: ${payment.va_number}`);
  if (payment.payment_url) details.push(`<a href="${payment.payment_url}" target="_blank" rel="noreferrer">Buka halaman pembayaran</a>`);
  if (payment.qr_image_url) details.push(`<a href="${payment.qr_image_url}" target="_blank" rel="noreferrer">Buka QRIS</a>`);
  paymentResult.innerHTML = details.map((item) => `<p>${item}</p>`).join('');
  paymentResult.classList.remove('hidden');
  queueText.classList.remove('hidden');
}

async function sendPaymentMessage(message) {
  if (!paymentSessionId) return;
  const payment = await api('/payment/chat/message', {
    method: 'POST',
    body: JSON.stringify({ session_id: paymentSessionId, message })
  });
  briefText.textContent = payment.reply;
  renderPaymentChoices(payment.choices || []);
  if (payment.payment) {
    renderPaymentResult(payment.payment);
    state.completed = Array.from(new Set([...state.completed, 'payment']));
    setScene('Payment is waiting', 'Payment instructions are ready and the doctor queue will open after verification.');
    startPaymentPolling();
  }
  renderTimeline();
}

function startPaymentPolling() {
  if (paymentPoll || !paymentSessionId) return;
  paymentPoll = window.setInterval(async () => {
    const status = await api(`/payment/chat/status/${paymentSessionId}`);
    if (status.followup) briefText.textContent = status.followup;
    if (status.status === 'paid') {
      window.clearInterval(paymentPoll);
      paymentPoll = null;
      state.completed = Array.from(new Set([...state.completed, 'payment', 'brief']));
      briefText.textContent = 'Pembayaran sudah masuk. Saya lanjutkan ke antrean dokter.';
      setScene('Doctor queue unlocked', 'The payment status is verified and the doctor briefing workflow can begin.');
      renderTimeline();
    }
  }, 30000);
}

roleToggle.addEventListener('click', () => {
  state.role = state.role === 'patient' ? 'doctor' : 'patient';
  roleToggle.textContent = state.role === 'patient' ? 'Doctor' : 'Patient';
  patientPanel.classList.toggle('hidden', state.role !== 'patient');
  doctorPanel.classList.toggle('hidden', state.role !== 'doctor');
});

async function startIntakeIfNeeded() {
  if (intakeSessionId) return;
  const start = await api('/intake/start', { method: 'POST', body: '{}' });
  intakeSessionId = start.session_id;
  addChatMessage('agent', start.reply);
}

document.querySelector('#startConsultation').addEventListener('click', async () => {
  await startIntakeIfNeeded();
  const message = patientMessage.value.trim();
  if (!message) return;
  addChatMessage('patient', message);
  patientMessage.value = '';

  const intake = await api('/intake/message', {
    method: 'POST',
    body: JSON.stringify({ session_id: intakeSessionId, message })
  });

  addChatMessage('agent', intake.reply);
  state.completed = ['intake'];
  if (intake.ready_for_payment) {
    intakeReadyForPayment = true;
    state.completed.push('symptoms');
    createPayment.classList.remove('hidden');
    briefText.textContent = 'Informasi awal sudah cukup. Silakan lanjut ke pembayaran agar masuk antrean dokter.';
    setScene('Anamnesis is ready', 'The consultation can move to payment and doctor handoff.');
  } else {
    briefText.textContent = `Intake agent is still collecting: ${(intake.missing_fields || []).join(', ') || 'more clinical context'}.`;
    setScene('Intake agent is asking follow-up questions', 'Answer the next anamnesis question so the doctor receives a structured briefing.');
  }
  renderTimeline();
});

createPayment.addEventListener('click', async () => {
  if (!intakeReadyForPayment) return;
  const payment = await api('/payment/chat/start', {
    method: 'POST',
    body: JSON.stringify({ intake_session_id: intakeSessionId })
  });
  paymentSessionId = payment.session_id;
  paymentLink.classList.add('hidden');
  paymentResult.classList.add('hidden');
  briefText.textContent = payment.reply;
  renderPaymentChoices(payment.choices || []);
  setScene('Payment is ready', 'Choose a payment method to continue to the doctor queue.');
  renderTimeline();
});

document.querySelector('#mockVoice').addEventListener('click', () => {
  patientMessage.value = 'Transkrip voice note: saya demam, batuk, dan badan lemas sejak 3 hari.';
  setScene('Voice note captured', 'The voice note is represented as a transcript and can be sent to the intake agent.');
});

document.querySelector('#doctorLogin').addEventListener('click', async () => {
  const username = document.querySelector('#doctorUser').value;
  const password = document.querySelector('#doctorPass').value;
  const login = await api('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  if (login.authenticated) {
    state.completed = Array.from(new Set([...state.completed, 'doctor']));
    setScene('Doctor workspace active', 'Doctor authentication succeeded. The review package is ready for approval.');
    renderTimeline();
  }
});

document.querySelector('#approveFinal').addEventListener('click', async () => {
  const approval = await api('/doctor/approve', { method: 'POST', body: '{}' });
  if (approval.approved) {
    state.completed = Array.from(new Set([...state.completed, 'review', 'delivery']));
    setScene('Final instructions delivered', 'Doctor-approved instructions are ready for the patient.');
    briefText.textContent = 'Final output approved by doctor. Delivery agent may send patient-facing instructions.';
    renderTimeline();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}

renderTimeline();
startIntakeIfNeeded().catch(() => {
  addChatMessage('agent', 'CareClaw intake is preparing your consultation.');
});
