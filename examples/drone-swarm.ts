/**
 * VECTRIX SDK - Drone Swarm Example
 *
 * Demonstrates drone swarm pathfinding simulation.
 *
 * Note: Requires VECTRIX_API_TOKEN environment variable.
 */

import { VectrixClient, DroneSwarmScenario, TokenMissingError } from '@vectrix/sdk';

async function main() {
  console.log('\n=== Drone Swarm Pathfinding Example ===\n');

  if (!process.env.VECTRIX_API_TOKEN) {
    throw new TokenMissingError();
  }

  const client = new VectrixClient({
    apiToken: process.env.VECTRIX_API_TOKEN,
    strictMode: true,
  });

  const scenario = new DroneSwarmScenario({
    droneCount: 50,
    worldSize: { x: 1000, y: 500, z: 1000 },
    obstaclesDensity: 0.15,
    formationType: 'swarm',
    plannerType: 'rrt-star',
    maxVelocity: 15,
  });

  const validation = scenario.validate();
  if (!validation.valid) {
    console.error('Scenario validation failed:', validation.errors);
    client.dispose();
    return;
  }

  const result = await client.simulate(scenario, {
    maxSteps: 5000,
    timestep: 0.016,
    seed: 12345,
  });

  console.log('Simulation completed:');
  console.log(`  - Status: ${result.status}`);
  console.log(`  - Trajectories: ${result.trajectories.length}`);
  console.log(`  - Collisions: ${result.collisionEvents.length}`);
  console.log(`  - Execution time: ${result.metrics.executionTimeMs.toFixed(2)}ms`);
  console.log(`  - Deterministic hash: ${result.metrics.deterministicHash}`);

  client.dispose();
}

main().catch((error) => {
  if (error instanceof TokenMissingError) {
    console.error('\n❌ Error: VECTRIX_API_TOKEN environment variable is not set.');
    console.error('   Set it with: export VECTRIX_API_TOKEN="vx_your_token_here"\n');
  } else {
    console.error('\n❌ Error:', error);
  }
  process.exit(1);
});
