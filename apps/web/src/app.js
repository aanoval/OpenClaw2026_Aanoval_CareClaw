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
const queueText = document.querySelector('#queueText');
const chatLog = document.querySelector('#chatLog');
const createPayment = document.querySelector('#createPayment');
const patientMessage = document.querySelector('#patientMessage');

let intakeSessionId = null;
let intakeReadyForPayment = false;

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
    briefText.textContent = 'The intake agent has enough anamnesis to create a payment link and place the patient in the doctor chat queue.';
    setScene('Anamnesis is ready', 'The intake agent has collected enough history for payment and doctor chat handoff.');
  } else {
    briefText.textContent = `Intake agent is still collecting: ${(intake.missing_fields || []).join(', ') || 'more clinical context'}.`;
    setScene('Intake agent is asking follow-up questions', 'Answer the next anamnesis question so the doctor receives a structured briefing.');
  }
  renderTimeline();
});

createPayment.addEventListener('click', async () => {
  if (!intakeReadyForPayment) return;
  const payment = await api('/payment/mock', { method: 'POST', body: '{}' });
  if (payment.payment_url) {
    state.completed.push('payment');
    paymentLink.href = payment.payment_url;
    paymentLink.classList.remove('hidden');
    queueText.classList.remove('hidden');
  }

  briefText.textContent = `Payment link created with ${payment.provider}. Complete payment to enter the doctor chat queue.`;
  setScene('DOKU payment link is ready', 'The patient is waiting for payment verification before the doctor chat opens.');
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
