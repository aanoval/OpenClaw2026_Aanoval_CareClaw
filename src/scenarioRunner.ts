import { readFileSync } from 'node:fs';
import path from 'node:path';
import { redFlagRoute } from './redFlagEscalation.js';
import { runWorkflow } from './workflowRunner.js';

const scenarioName = process.argv[2] || 'normal';
const scenarioPath = path.join('examples', 'scenarios', `${scenarioName}.json`);
const scenario = JSON.parse(readFileSync(scenarioPath, 'utf8')) as { name: string; message: string };
const result = runWorkflow({
  message: scenario.message,
  consultationId: `scenario-${scenario.name}`,
  autoApproveDoctor: true
});

console.log(
  JSON.stringify(
    {
      scenario: scenario.name,
      route: redFlagRoute(result.state),
      final_status: result.state.status,
      doctor_approved: result.state.doctorApproved,
      events: result.events,
      symptoms: result.state.symptoms,
      red_flags: result.state.redFlags
    },
    null,
    2
  )
);
