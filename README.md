# @vectrix/sdk

[![npm version](https://badge.fury.io/js/%40vectrix%2Fsdk.svg)](https://www.npmjs.com/package/@vectrix/sdk)
[![License](https://img.shields.io/badge/license-proprietary-red.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)

**Distributed physics simulation SDK for multi-robot motion planning and pathfinding.**

VECTRIX SDK provides high-performance, deterministic simulation capabilities for robotics applications including drone swarms, warehouse automation, and autonomous vehicle testing.

## Features

- 🚀 **High-Performance Simulation** — Optimized physics engine with configurable integrators
- 🎯 **Deterministic Execution** — Reproducible results with seeded RNG and fixed timesteps
- 🔀 **Distributed Computing** — Scale simulations across multiple nodes
- 🛡️ **Collision Detection** — Broadphase + narrowphase pipeline with contact events
- 🗺️ **Path Planning** — A*, RRT*, and custom planner integration
- 📊 **Scenario Generation** — Domain randomization and edge-case fuzzing
- 📝 **Comprehensive Logging** — Event tracing and profiling tools

## Installation

```bash
npm install @vectrix/sdk
```

## Quick Start

```typescript
import { VectrixClient, DroneSwarmScenario } from '@vectrix/sdk';

// Initialize with your API token
const client = new VectrixClient({
  apiToken: process.env.VECTRIX_API_TOKEN,
});

// Create a drone swarm scenario
const scenario = new DroneSwarmScenario({
  droneCount: 50,
  worldSize: { x: 1000, y: 1000, z: 500 },
  obstaclesDensity: 0.15,
});

// Run simulation
const result = await client.simulate(scenario, {
  maxSteps: 10000,
  timestep: 0.016,
});

console.log('Trajectories:', result.trajectories.length);
console.log('Collisions:', result.collisionEvents.length);
console.log('Execution time:', result.metrics.executionTimeMs);
```

## Scenarios

### Drone Swarm Pathfinding

Optimize routes for hundreds of drones with collision avoidance.

```typescript
import { DroneSwarmScenario } from '@vectrix/sdk/scenarios';

const scenario = new DroneSwarmScenario({
  droneCount: 100,
  worldSize: { x: 2000, y: 2000, z: 800 },
  obstaclesDensity: 0.2,
  collisionRadius: 2.5,
  maxVelocity: 15,
  plannerType: 'rrt-star',
});
```

### Warehouse Robotics

Plan routes for autonomous forklifts and AGVs.

```typescript
import { WarehouseScenario } from '@vectrix/sdk/scenarios';

const scenario = new WarehouseScenario({
  robotCount: 20,
  warehouseLayout: 'grid-3x3',
  shelfDensity: 0.6,
  aisleWidth: 3.5,
  loadCapacity: 500,
  priorityRouting: true,
});
```

## Distributed Execution

Scale simulations across multiple workers:

```typescript
import { DistributedExecutor } from '@vectrix/sdk/executor';

const executor = new DistributedExecutor({
  workerCount: 8,
  transportLayer: 'ipc',
});

const results = await executor.runBatch(scenarios, {
  parallelism: 4,
  timeout: 30000,
});
```

## Deterministic Replay

Reproduce any simulation run exactly:

```typescript
import { ReproPack } from '@vectrix/sdk';

// Save repro pack
const reproPack = result.getReproPack();
await reproPack.save('./debug/crash-001.vxr');

// Load and replay
const loaded = await ReproPack.load('./debug/crash-001.vxr');
const replayed = await client.replay(loaded);
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VECTRIX_API_TOKEN` | Your API authentication token | Yes |
| `VECTRIX_API_URL` | Custom API endpoint | No |
| `VECTRIX_LOG_LEVEL` | Logging verbosity (debug/info/warn/error) | No |
| `VECTRIX_STRICT_MODE` | Fail on NaN/divergence (true/false) | No |

### Client Options

```typescript
const client = new VectrixClient({
  apiToken: 'vx_...',
  apiUrl: 'https://api.vectrix.dev/v2',
  timeout: 30000,
  retries: 3,
  strictMode: true,
  logger: customLogger,
});
```

## API Reference

Full API documentation available at [docs.vectrix.dev](https://docs.vectrix.dev)

### Core Classes

- `VectrixClient` — Main SDK entry point
- `World` — Simulation world container
- `Entity` — Base class for all simulated objects
- `State` — Immutable state snapshot
- `DeterministicRuntime` — Reproducible execution engine

### Interfaces

- `ISimulator` — Simulation backend contract
- `IPhysicsBackend` — Physics engine interface
- `ICollisionBackend` — Collision detection interface
- `IPlanner` — Path planning interface
- `ILogger` — Logging interface

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0.0 (optional, for type definitions)
- Valid VECTRIX API token

## Support

- 📚 Documentation: [docs.vectrix.dev](https://docs.vectrix.dev)
- 💬 Discord: [discord.gg/vectrix](https://discord.gg/vectrix)
- 📧 Email: support@vectrix.dev
- 🐛 Issues: [github.com/vectrix-lab/sdk/issues](https://github.com/vectrix-lab/sdk/issues)

## License

Proprietary. See [LICENSE](./LICENSE) for details.

---

© 2024 VECTRIX Lab. All rights reserved.

