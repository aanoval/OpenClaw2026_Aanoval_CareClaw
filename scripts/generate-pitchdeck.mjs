import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const output = path.resolve('pitch/OpenClaw2026_Aanoval_CareClaw.pdf');
mkdirSync(path.dirname(output), { recursive: true });

const width = 960;
const height = 540;

const slides = [
  {
    eyebrow: 'OpenClaw2026_Aanoval_CareClaw',
    title: 'Problem Statement',
    subtitle: 'Team Aanoval | CareClaw',
    bullets: [
      'Online consultations often start with incomplete, unstructured patient chat.',
      'Doctors lose time collecting basic history, checking red flags, and preparing notes.',
      'Payment and doctor access are usually detached from the clinical workflow.',
      'A basic chatbot is not enough: the workflow needs task execution, safety gates, and handoff.'
    ]
  },
  {
    eyebrow: 'Solution Overview',
    title: 'CareClaw',
    subtitle: 'A multi-agent healthcare communication system built around OpenClaw.',
    bullets: [
      'Patient starts from a mobile-first PWA with guided intake.',
      'OpenClaw runs the autonomous consultation handoff task.',
      'Specialized agents structure symptoms, detect safety signals, create payment gates, and brief doctors.',
      'Doctors remain the final medical decision makers.'
    ]
  },
  {
    eyebrow: 'AI Agent Workflow',
    title: 'Autonomous Handoff Architecture',
    subtitle: 'The visible product task is not a chat reply; it is a completed workflow artifact.',
    bullets: [
      'Patient PWA -> API -> OpenClaw Intake Bridge -> Orchestrator.',
      'Orchestrator -> Symptom Extraction -> Safety Gate -> Payment Agent -> Doctor Briefing.',
      'Output includes agent trace, tool calls, handoffs, payment gate, and doctor briefing.',
      'The workflow continues until the consultation handoff task is completed.'
    ]
  },
  {
    eyebrow: 'Key Features & Tech Stack',
    title: 'What Works Now',
    subtitle: 'Designed to be reproducible, inspectable, and deployable.',
    bullets: [
      'OpenClaw workspace, bridge, and Docker runtime.',
      'Autonomous consultation handoff demo and live API endpoints.',
      'DOKU-compatible payment flow with QRIS and Virtual Account path.',
      'Patient PWA, hidden doctor workspace, doctor queue, and approval gate.',
      'Node.js, TypeScript, Docker Compose, Nginx, vanilla PWA.'
    ]
  },
  {
    eyebrow: 'Future Development / Impact',
    title: 'From Demo To Clinic Workflow',
    subtitle: 'AI handles workflow; doctors handle medical decisions.',
    bullets: [
      'Reduce doctor intake burden and improve consultation readiness.',
      'Add production payment callbacks, scheduling, and multi-doctor routing.',
      'Support voice-note intake and WhatsApp continuation.',
      'Improve medical RAG, red-flag scoring, and clinic-specific agent skills.',
      'Make safer, faster, and more meaningful doctor-patient communication accessible.'
    ]
  }
];

function esc(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function lineWrap(text, max = 82) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function text(content, x, y, size = 24, font = 'F1', color = [0.06, 0.14, 0.25]) {
  const [r, g, b] = color;
  return `BT ${r} ${g} ${b} rg /${font} ${size} Tf ${x} ${y} Td (${esc(content)}) Tj ET\n`;
}

function rect(x, y, w, h, color) {
  const [r, g, b] = color;
  return `q ${r} ${g} ${b} rg ${x} ${y} ${w} ${h} re f Q\n`;
}

function slideStream(slide, index) {
  let s = '';
  s += rect(0, 0, width, height, [0.94, 0.98, 1.0]);
  s += rect(0, 0, width, 18, [0.08, 0.43, 0.78]);
  s += rect(0, height - 92, width, 92, [0.82, 0.94, 1.0]);
  s += rect(58, height - 102, 82, 7, [0.10, 0.56, 0.88]);
  s += text(slide.eyebrow, 60, 485, 15, 'F2', [0.10, 0.42, 0.66]);
  s += text(slide.title, 60, 436, 38, 'F2', [0.04, 0.15, 0.30]);
  s += text(slide.subtitle, 60, 400, 18, 'F1', [0.30, 0.42, 0.56]);

  let y = 338;
  for (const bullet of slide.bullets) {
    const lines = lineWrap(bullet, 86);
    s += text('•', 74, y, 20, 'F2', [0.08, 0.48, 0.78]);
    lines.forEach((line, i) => {
      s += text(line, 102, y - i * 23, 18, 'F1', [0.08, 0.15, 0.25]);
    });
    y -= 34 + (lines.length - 1) * 23;
  }

  s += text(`Slide ${index + 1} / 5`, 818, 34, 12, 'F1', [0.36, 0.48, 0.60]);
  s += text('CareClaw', 60, 34, 12, 'F2', [0.10, 0.42, 0.66]);
  return s;
}

const objects = [];
function add(body) {
  objects.push(body);
  return objects.length;
}

const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

const pageIds = [];
for (let i = 0; i < slides.length; i++) {
  const stream = slideStream(slides[i], i);
  const contentId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`);
  const pageId = add(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`);
  pageIds.push(pageId);
}

const pagesId = add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
for (const id of pageIds) {
  objects[id - 1] = objects[id - 1].replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`);
}
const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

let pdf = '%PDF-1.4\n';
const offsets = [0];
objects.forEach((body, index) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
});
const xrefOffset = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let i = 1; i <= objects.length; i++) {
  pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

writeFileSync(output, pdf);
console.log(output);
