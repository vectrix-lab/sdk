# VECTRIX SDK — Roadmap

> **Current Version:** 2.4.1  
> **Status:** Active Development  
> **Last Updated:** December 2024

---

## Current Focus (v2.5.0)

Active development priorities for the next release:

| Feature | Status | Owner |
|---------|--------|-------|
| Path following for entities | 🔄 In Progress | Core Team |
| DroneSwarm formations & communication | 🔄 In Progress | Scenarios Team |
| Warehouse task queue system | 📋 Planned | Scenarios Team |
| AV edge-case scenario expansion | 📋 Planned | Scenarios Team |

---

## Milestone: v2.5.0 — Simulation Enhancements

**Target:** Q1 2026

### Core & Types
- [ ] Image data encoding support for `CameraData`
- [ ] Algorithm-specific options for `PlannerConfig`

### Simulation Runtime
- [ ] Entity path following implementation
- [ ] Variable timestep integrator for complex scenarios
- [ ] Energy checks and divergence detectors

### Scenarios
- [ ] DroneSwarm: formations, swarm communication
- [ ] Warehouse: task queue system for robots
- [ ] AVEdgeCase: expanded edge-case generation
- [ ] Add `examples/av-edge-case.ts` usage example

---

## Milestone: v2.6.0 — Distributed Computing

**Target:** Q2 2026

### Distributed Executor
- [ ] Remote worker communication (production-ready)
- [ ] gRPC transport layer for distributed computing
- [ ] IPC transport for local parallelism
- [ ] Worker monitoring and health checks
- [ ] Load balancing and failover

### Collision System
- [ ] BVH (Bounding Volume Hierarchy) for broadphase acceleration
- [ ] Octree backend for large open scenes
- [ ] Continuous collision detection (CCD)

### Pathfinding
- [ ] RRT* optimization with rewiring
- [ ] PRM (Probabilistic Roadmap) planner
- [ ] OMPL integration bridge

---

## Milestone: v3.0.0 — Integrations & Adapters

**Target:** Q3 2026

### Format Parsers
- [ ] URDF parser for robot models
- [ ] SDF parser (Gazebo format)
- [ ] MJCF parser (MuJoCo format)

### Simulation Adapters
- [ ] Unity adapter
- [ ] Unreal Engine adapter
- [ ] Gazebo adapter
- [ ] Isaac Sim adapter

### Language Bindings
- [ ] Python bindings (WASM/native wrapper)
- [ ] REST API wrapper for web integrations

---

## Future Considerations (v3.x+)

### GPU Acceleration
- [ ] WebGPU backend for collision detection
- [ ] GPU batching for parallel simulations

### Real-time Streaming
- [ ] WebSocket API for streaming updates
- [ ] Incremental state snapshots

### Testing & Validation
- [ ] Property-based testing (QuickCheck-style)
- [ ] Mutation-based fuzzing on state/action
- [ ] Delta-debugging minimizer for counterexamples
- [ ] Golden tests framework
- [ ] Automated simulation quality metrics

---

## Technical Debt

Ongoing maintenance tasks:

- [ ] Remove unused parameters (marked as `_param`)
- [ ] Unit tests for critical modules
- [ ] CI/CD pipeline setup
- [ ] JSDoc documentation for public APIs

---

## Changelog

### v2.4.1 (Current)
- Core SDK architecture
- Scenarios: DroneSwarm, Warehouse (see `examples/`)
- AVEdgeCase scenario (implementation ready, examples pending)
- Local and Distributed executors (mock implementation)
- Collision detection: broadphase + narrowphase pipeline
- Pathfinding: A* and RRT planners
- Seeded RNG for deterministic execution
- Token-based authentication

### v2.4.0
- Initial public release
- Basic simulation runtime
- Entity and World abstractions
