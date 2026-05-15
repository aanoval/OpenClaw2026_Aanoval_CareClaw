import http from 'node:http';
import { execFile } from 'node:child_process';

const host = process.env.OPENCLAW_BRIDGE_HOST || '0.0.0.0';
const port = Number(process.env.OPENCLAW_BRIDGE_PORT || 18800);
const timeoutMs = Number(process.env.OPENCLAW_AGENT_EXEC_TIMEOUT_MS || 45000);

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeAgentPayload(parsed, rawText) {
  const safe = parsed && typeof parsed === 'object' ? parsed : {};
  const reply = typeof safe.reply === 'string' && safe.reply.trim()
    ? safe.reply.trim()
    : rawText.trim();
  return {
    reply,
    ready_for_payment: Boolean(safe.ready_for_payment),
    missing_fields: Array.isArray(safe.missing_fields) ? safe.missing_fields : [],
    collected: safe.collected && typeof safe.collected === 'object' ? safe.collected : {},
    next_action: typeof safe.next_action === 'string' ? safe.next_action : 'ask_more'
  };
}

function buildPrompt(body) {
  const state = body.state && typeof body.state === 'object' ? body.state : {};
  const recentMessages = Array.isArray(state.messages) ? state.messages.slice(-10) : [];
  const collected = state.collected && typeof state.collected === 'object' ? state.collected : {};
  const symptomExtraction = state.symptom_extraction && typeof state.symptom_extraction === 'object' ? state.symptom_extraction : {};
  const orchestrator = state.orchestrator && typeof state.orchestrator === 'object' ? state.orchestrator : {};
  const patientMessage = String(body.message || '').trim();

  return `You are the CareClaw patient intake workspace agent running inside OpenClaw.

You behave like AI-MEDIKA, an Indonesian primary-care general-practice assistant.

Task:
- Continue a natural Indonesian patient intake conversation.
- Ask only one useful follow-up question at a time.
- Adapt to the patient's complaint and prior answers.
- Use the provided symptom_extraction and orchestrator state as clinical memory.
- Do not ask again for information that is already present in symptom_extraction, collected, or the recent conversation.
- If orchestrator.next_best_question exists and the patient has not answered that topic, use it or a natural close paraphrase.
- Do not mention agents, workflows, JSON, models, tools, development, or internal architecture to the patient.
- Do not diagnose, prescribe, or replace a doctor.
- Escalate urgently if there are red flags such as severe shortness of breath, chest pain, fainting, seizure, severe dehydration, pregnancy danger signs, stroke symptoms, or severe allergic reaction.
- Mark ready_for_payment only when enough initial intake and safety context has been collected for a doctor handoff.
- Do not call tools. Do not send messages through external channels. Return only one JSON object.

Current collected context:
${JSON.stringify(collected)}

Symptom extraction state:
${JSON.stringify(symptomExtraction)}

Orchestrator state:
${JSON.stringify(orchestrator)}

Recent conversation:
${JSON.stringify(recentMessages)}

Latest patient message:
${patientMessage}

Return strict JSON only:
{
  "reply": "natural patient-facing Indonesian reply",
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
  },
  "next_action": "ask_more"
}`;
}

function runOpenClawAgent(body) {
  return new Promise((resolve, reject) => {
    const prompt = buildPrompt(body);
    const args = [
      'agent',
      '--local',
      '--agent',
      process.env.OPENCLAW_BRIDGE_AGENT || 'main',
      '--json',
      '--thinking',
      process.env.OPENCLAW_BRIDGE_THINKING || 'low',
      '--message',
      prompt,
      '--timeout',
      String(Math.ceil(timeoutMs / 1000))
    ];

    const sessionId = String(body.session_id || '').trim();
    if (sessionId) args.push('--session-id', sessionId);

    const startedAt = Date.now();
    execFile('openclaw', args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 4 }, (error, stdout, stderr) => {
      const durationMs = Date.now() - startedAt;
      if (error) {
        const failure = new Error(error.killed ? 'OpenClaw agent timed out' : 'OpenClaw agent failed');
        failure.details = String(stderr || error.message || '').slice(0, 1200);
        failure.durationMs = durationMs;
        reject(failure);
        return;
      }

      let cliPayload;
      try {
        cliPayload = JSON.parse(stdout);
      } catch {
        const failure = new Error('OpenClaw agent returned invalid JSON output');
        failure.details = String(stdout || stderr || '').slice(0, 1200);
        failure.durationMs = durationMs;
        reject(failure);
        return;
      }

      const payloads = Array.isArray(cliPayload.payloads) ? cliPayload.payloads : [];
      const textPayload = payloads.find((item) => typeof item?.text === 'string' && item.text.trim().startsWith('{'))
        || payloads.find((item) => typeof item?.text === 'string');
      const rawText = String(textPayload?.text || '').trim();
      const parsed = extractJson(rawText);
      const normalized = normalizeAgentPayload(parsed, rawText);

      resolve({
        ok: true,
        source: 'openclaw',
        ...normalized,
        openclaw: {
          session_id: sessionId || cliPayload.sessionId || null,
          model: cliPayload.meta?.agentMeta?.model || null,
          provider: cliPayload.meta?.agentMeta?.provider || null,
          duration_ms: durationMs
        }
      });
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'careclaw-openclaw-bridge' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/agent') {
    try {
      const body = await readBody(req);
      if (!String(body.message || '').trim()) {
        sendJson(res, 400, { ok: false, error: 'Message is required' });
        return;
      }
      const result = await runOpenClawAgent(body);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, error.message?.includes('timed out') ? 504 : 502, {
        ok: false,
        error: error.message || 'OpenClaw bridge failed',
        details: error.details || ''
      });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(port, host, () => {
  console.log(`CareClaw OpenClaw bridge listening on ${host}:${port}`);
});
