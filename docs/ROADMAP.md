# VECTRIX SDK — Roadmap

## Priority 1: Near-term Improvements

### Core & Types
- [ ] `src/core/types.ts:217` — Add image data encoding support for CameraData
- [ ] `src/core/types.ts:455` — Extend PlannerConfig with algorithm-specific options

### Simulation
- [ ] `src/simulation/runtime.ts:249` — Implement path following for entities
- [ ] Add variable timestep integrator for complex scenarios
- [ ] Implement energy checks and divergence detectors

### Scenarios
- [ ] `src/scenarios/drone-swarm.ts:32` — Extend DroneSwarm configuration (formations, communication)
- [ ] `src/scenarios/warehouse.ts:31` — Add task queue system for robots
- [ ] `src/scenarios/av-edge-case.ts:31` — Expand edge-case scenario generation
- [ ] Добавить пример использования `examples/av-edge-case.ts` после доработки AVEdgeCaseScenario

---

## Priority 2: Architectural Improvements

### Distributed Executor
- [ ] `src/executor/distributed.ts:355` — Implement actual remote worker communication
- [ ] gRPC transport for distributed computing
- [ ] IPC transport for local parallelism
- [ ] Worker monitoring and health checks

### Collision System
- [ ] BVH (Bounding Volume Hierarchy) for broadphase acceleration
- [ ] Octree backend for large open scenes
- [ ] Continuous collision detection (CCD)

### Pathfinding
- [ ] RRT* optimization with rewiring
- [ ] PRM (Probabilistic Roadmap) planner
- [ ] Integration with external planners (OMPL)

---

## Priority 3: Integrations & Adapters

### Format Parsers
- [ ] URDF parser for robot models
- [ ] SDF parser (Gazebo format)
- [ ] MJCF parser (MuJoCo format)

### External Integrations
- [ ] Unity adapter
- [ ] Unreal Engine adapter
- [ ] Gazebo adapter
- [ ] Isaac Sim adapter

### Bindings
- [ ] Python bindings (thin wrapper via WASM or native)
- [ ] REST API wrapper for web integrations

---

## Priority 4: Advanced Features

### GPU Acceleration
- [ ] WebGPU backend for collision detection
- [ ] GPU batching for simulations

### Streaming & Real-time
- [ ] WebSocket API for streaming updates
- [ ] Incremental state snapshots

### Edge-Case Generation
- [ ] Property-based testing (QuickCheck-style)
- [ ] Mutation-based fuzzing on state/action
- [ ] Delta-debugging minimizer for counterexamples

### Validation & Testing
- [ ] Golden tests framework
- [ ] Regression test suite
- [ ] Automated simulation quality metrics

---

## Technical Debt

- [ ] Remove unused parameters (marked as `_param`)
- [ ] Add unit tests for critical modules
- [ ] Set up CI/CD pipeline
- [ ] Add JSDoc documentation for all public APIs

---

## Changelog

### v2.4.1 (current)
- Basic SDK structure
- DroneSwarm, Warehouse scenarios (примеры в `examples/`)
- AVEdgeCase scenario (код готов, примеры будут добавлены позже)
- Local and Distributed executors (mock)
- Collision detection (broadphase + narrowphase)
- A* and RRT planners
- Seeded RNG for determinism
- Token-based authentication
