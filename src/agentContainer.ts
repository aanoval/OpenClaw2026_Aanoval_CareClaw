import { agentRegistry, type AgentId } from './agentRegistry.js';
import { createDemoState } from './state.js';

const agentName = (process.env.AGENT_NAME || 'orchestrator') as AgentId;
const agent = agentRegistry.find((entry) => entry.id === agentName);

if (!agent) {
  throw new Error(`Unknown agent: ${agentName}`);
}

const result = agent.run('I have had fever and cough for three days.', createDemoState());

console.log(
  JSON.stringify(
    {
      container_mode: 'single-agent',
      agent: agent.id,
      emitted: result.event,
      output: result.output
    },
    null,
    2
  )
);
