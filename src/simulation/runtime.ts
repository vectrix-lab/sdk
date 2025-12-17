/**
 * VECTRIX SDK Simulation Runtime
 * @module @vectrix/sdk/simulation
 */

import type {
  EntityId,
  EntityDescriptor,
  EntityState,
  StateSnapshot,
  SimulationConfig,
  Action,
  ISimulator,
  ILogger,
  Vector3,
  WorldConfig,
} from '../core/types';
import { DivergenceError } from '../core/errors';
import { Entity, createEntity, generateEntityId } from '../world/entity';
import { StateBuilder } from '../world/state';
import { Vec3 } from '../world/transform';
import { createIntegrator, checkStability } from './integrators';
import { DeterministicRuntime, hashVector3, combineHashes } from './deterministic';

// =============================================================================
// Simulation Runtime
// =============================================================================

export interface RuntimeConfig extends SimulationConfig {
  worldConfig: WorldConfig;
  logger?: ILogger;
}

export class SimulationRuntime implements ISimulator {
  private readonly config: RuntimeConfig;
  private readonly logger?: ILogger;
  private readonly entities = new Map<EntityId, Entity>();
  private readonly integrator;
  private readonly deterministicRuntime: DeterministicRuntime;

  private initialized = false;
  private currentStep = 0;
  private simulationTime = 0;
  private totalCollisions = 0;

  constructor(config: RuntimeConfig) {
    this.config = config;
    this.logger = config.logger;
    this.integrator = createIntegrator(config.integrator ?? 'semi-implicit-euler');
    this.deterministicRuntime = new DeterministicRuntime({
      fixedTimestep: config.timestep,
      seed: config.seed,
      validateDeterminism: config.strictMode,
    });
  }

  // ===========================================================================
  // ISimulator Implementation
  // ===========================================================================

  async initialize(_config: SimulationConfig): Promise<void> {
    if (this.initialized) return;

    this.logger?.debug('Initializing simulation runtime', {
      timestep: this.config.timestep,
      integrator: this.config.integrator,
      seed: this.config.seed,
    });

    this.initialized = true;
  }

  async step(actions: Action[]): Promise<StateSnapshot> {
    if (!this.initialized) {
      await this.initialize(this.config);
    }

    // Process actions
    this.processActions(actions);

    // Physics step
    this.physicsStep(this.config.timestep);

    // Stability check
    if (this.config.strictMode) {
      this.validateStability();
    }

    // Update counters
    this.currentStep++;
    this.simulationTime += this.config.timestep;

    // Record hash for determinism
    const stepHash = this.computeStepHash();
    this.deterministicRuntime.recordStepHash(stepHash);

    return this.getState();
  }

  getState(): StateSnapshot {
    const builder = new StateBuilder()
      .setVersion(3)
      .setTimestamp(Date.now())
      .setStep(this.currentStep)
      .setWorldState({
        time: this.simulationTime,
        gravity: this.config.worldConfig.gravity,
        bounds: this.config.worldConfig.bounds,
        activeEntityCount: this.entities.size,
        totalCollisions: this.totalCollisions,
      });

    for (const entity of this.entities.values()) {
      builder.addEntity(entity.getState());
    }

    return builder.build();
  }

  async reset(): Promise<void> {
    this.entities.clear();
    this.currentStep = 0;
    this.simulationTime = 0;
    this.totalCollisions = 0;
    this.deterministicRuntime.reset();
    this.logger?.debug('Simulation runtime reset');
  }

  dispose(): void {
    this.entities.clear();
    this.initialized = false;
  }

  // ===========================================================================
  // Entity Management
  // ===========================================================================

  addEntity(descriptor: EntityDescriptor): Entity {
    const entity = createEntity(descriptor);
    this.entities.set(entity.id, entity);
    this.logger?.debug('Entity added', { id: entity.id, type: entity.type });
    return entity;
  }

  addEntities(descriptors: EntityDescriptor[]): Entity[] {
    return descriptors.map(d => this.addEntity(d));
  }

  removeEntity(id: EntityId): boolean {
    const removed = this.entities.delete(id);
    if (removed) {
      this.logger?.debug('Entity removed', { id });
    }
    return removed;
  }

  getEntity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  getEntityState(id: EntityId): EntityState | undefined {
    return this.entities.get(id)?.getState();
  }

  getEntityCount(): number {
    return this.entities.size;
  }

  // ===========================================================================
  // Physics
  // ===========================================================================

  private physicsStep(dt: number): void {
    const gravity = this.config.worldConfig.gravity;

    for (const entity of this.entities.values()) {
      if (entity.status === 'disabled') continue;
      if (entity.type === 'obstacle') continue; // Static obstacles don't move

      const state = entity.getState();
      // Entity mass available for future physics calculations
      // const mass = entity.properties.mass ?? 1;

      // Compute acceleration (gravity + any applied forces)
      const acceleration: Vector3 = {
        x: gravity.x,
        y: entity.type === 'drone' ? 0 : gravity.y, // Drones hover
        z: gravity.z,
      };

      // Integrate
      const result = this.integrator.integrate(
        {
          position: state.transform.position,
          velocity: state.velocity,
          acceleration,
        },
        dt
      );

      // Apply velocity damping
      const damping = 0.99;
      const dampedVelocity = Vec3.mul(result.velocity, damping);

      // Clamp to max velocity
      const maxVel = entity.properties.maxVelocity ?? 100;
      const speed = Vec3.length(dampedVelocity);
      const clampedVelocity = speed > maxVel
        ? Vec3.mul(Vec3.normalize(dampedVelocity), maxVel)
        : dampedVelocity;

      // Update entity
      entity.setPosition(result.position);
      entity.setVelocity(clampedVelocity);

      // Update status based on velocity
      if (Vec3.lengthSq(clampedVelocity) > 0.01) {
        entity.setStatus('moving');
      } else {
        entity.setStatus('idle');
      }
    }
  }

  // ===========================================================================
  // Actions
  // ===========================================================================

  private processActions(actions: Action[]): void {
    for (const action of actions) {
      const entity = this.entities.get(action.entityId);
      if (!entity) continue;

      switch (action.type) {
        case 'move_to':
          this.handleMoveTo(entity, action.parameters.target);
          break;
        case 'set_velocity':
          if (action.parameters.velocity) {
            entity.setVelocity(action.parameters.velocity);
            entity.setStatus('moving');
          }
          break;
        case 'stop':
          entity.setVelocity(Vec3.zero());
          entity.setStatus('idle');
          break;
        case 'follow_path':
          // todo: Implement path following
          this.logger?.debug('Path following not yet implemented', { entityId: action.entityId });
          break;
        default:
          break;
      }
    }
  }

  private handleMoveTo(entity: Entity, target?: Vector3): void {
    if (!target) return;

    const position = entity.position;
    const direction = Vec3.normalize(Vec3.sub(target, position));
    const speed = entity.properties.maxVelocity ?? 10;
    const velocity = Vec3.mul(direction, speed);

    entity.setVelocity(velocity);
    entity.setStatus('moving');
    entity.setMetadata('target', target);
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  private validateStability(): void {
    const states = Array.from(this.entities.values())
      .filter(e => e.status !== 'disabled')
      .map(e => ({
        position: e.position,
        velocity: e.velocity,
        acceleration: { x: 0, y: 0, z: 0 },
      }));

    const result = checkStability(states);

    if (!result.stable) {
      if (result.hasNaN) {
        throw new DivergenceError('NaN detected in entity state', this.currentStep);
      }
      if (result.hasInfinity) {
        throw new DivergenceError('Infinity detected in entity state', this.currentStep);
      }
      if (result.divergenceDetected) {
        throw new DivergenceError(
          `Velocity/acceleration exceeded limits (vel: ${result.maxVelocity.toFixed(2)}, acc: ${result.maxAcceleration.toFixed(2)})`,
          this.currentStep
        );
      }
    }
  }

  private computeStepHash(): number {
    const hashes: number[] = [this.currentStep];

    // Sort entities by ID for deterministic ordering
    const sortedEntities = Array.from(this.entities.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    for (const [_, entity] of sortedEntities) {
      hashes.push(hashVector3(entity.position));
      hashes.push(hashVector3(entity.velocity));
    }

    return combineHashes(...hashes);
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  getCurrentStep(): number {
    return this.currentStep;
  }

  getSimulationTime(): number {
    return this.simulationTime;
  }

  getDeterministicHash(): string {
    return this.deterministicRuntime.computeFinalHash();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createSimulationRuntime(config: RuntimeConfig): SimulationRuntime {
  return new SimulationRuntime(config);
}

// =============================================================================
// Quick Entity Builder
// =============================================================================

export function createQuickEntity(
  type: EntityDescriptor['type'],
  position: Vector3,
  options?: Partial<EntityDescriptor['properties']>
): EntityDescriptor {
  return {
    id: generateEntityId(type.slice(0, 3)),
    type,
    transform: {
      position,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    properties: {
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      collisionRadius: 1,
      maxVelocity: 20,
      maxAcceleration: 50,
      ...options,
    },
  };
}

// Performance optimizations
// Performance optimizations
