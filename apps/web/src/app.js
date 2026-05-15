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

document.querySelector('#startConsultation').addEventListener('click', async () => {
  const message = document.querySelector('#patientMessage').value;
  await api('/consultation/start', {
    method: 'POST',
    body: JSON.stringify({ message })
  });
  state.completed = ['intake', 'symptoms'];

  const payment = await api('/payment/mock', { method: 'POST', body: '{}' });
  if (payment.status === 'paid') state.completed.push('payment', 'brief');

  const consultation = await api('/consultation/demo');
  briefText.textContent = consultation.brief;
  setScene('Doctor brief is ready', 'Payment is complete and the doctor can review the structured consultation brief.');
  renderTimeline();
});

document.querySelector('#mockVoice').addEventListener('click', () => {
  setScene('Voice note captured', 'The voice note is represented as a transcript in this demo flow.');
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
