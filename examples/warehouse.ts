/**
 * VECTRIX SDK - Warehouse Robotics Example
 *
 * Demonstrates warehouse robot simulation with priority routing.
 *
 * Note: Requires VECTRIX_API_TOKEN environment variable.
 */

import { VectrixClient, WarehouseScenario, TokenMissingError } from '@vectrix/sdk';

async function main() {
  console.log('\n=== Warehouse Robotics Example ===\n');

  if (!process.env.VECTRIX_API_TOKEN) {
    throw new TokenMissingError();
  }

  const client = new VectrixClient({
    apiToken: process.env.VECTRIX_API_TOKEN,
  });

  const scenario = new WarehouseScenario({
    robotCount: 20,
    warehouseLayout: 'grid-3x3',
    shelfDensity: 0.6,
    aisleWidth: 3.5,
    loadCapacity: 500,
    priorityRouting: true,
  });

  const result = await client.simulate(scenario, {
    maxSteps: 10000,
    timestep: 0.016,
  });

  console.log('Warehouse simulation completed:');
  console.log(`  - Robots: ${result.trajectories.length}`);
  console.log(`  - Collision events: ${result.collisionEvents.length}`);
  console.log(`  - Average step time: ${result.metrics.averageStepTimeMs.toFixed(3)}ms`);

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
