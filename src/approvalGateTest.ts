import { runFinalDeliveryAgent } from './agents/finalDelivery.js';
import { createDemoState } from './state.js';

const state = createDemoState();

try {
  runFinalDeliveryAgent(state);
  throw new Error('Approval gate failed: final delivery should require doctor approval.');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes('doctor approval')) throw error;
}

console.log('doctor approval gate passed');
