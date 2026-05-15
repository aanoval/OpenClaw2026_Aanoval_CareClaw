import { runAutonomousConsultationHandoff } from './tasks/autonomousConsultationHandoff.js';

const openingMessage = process.argv.slice(2).join(' ') || 'I have had fever and cough for three days.';
const result = runAutonomousConsultationHandoff(openingMessage);

console.log(JSON.stringify(result, null, 2));
