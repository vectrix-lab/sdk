/**
 * VECTRIX SDK State Management
 * @module @vectrix/sdk/world
 */

import type {
  EntityId,
  EntityState,
  StateSnapshot,
  WorldState,
  Vector3,
} from '../core/types';

// =============================================================================
// State Builder
// =============================================================================

export class StateBuilder {
  private version = 1;
  private timestamp = Date.now();
  private step = 0;
  private entities = new Map<EntityId, EntityState>();
  private worldState: WorldState;

  constructor() {
    this.worldState = {
      time: 0,
      gravity: { x: 0, y: -9.81, z: 0 },
      bounds: {
        min: { x: -1000, y: -100, z: -1000 },
        max: { x: 1000, y: 1000, z: 1000 },
      },
      activeEntityCount: 0,
      totalCollisions: 0,
    };
  }

  setVersion(version: number): this {
    this.version = version;
    return this;
  }

  setTimestamp(timestamp: number): this {
    this.timestamp = timestamp;
    return this;
  }

  setStep(step: number): this {
    this.step = step;
    return this;
  }

  addEntity(state: EntityState): this {
    this.entities.set(state.id, state);
    return this;
  }

  removeEntity(id: EntityId): this {
    this.entities.delete(id);
    return this;
  }

  setWorldState(state: Partial<WorldState>): this {
    this.worldState = { ...this.worldState, ...state };
    return this;
  }

  setGravity(gravity: Vector3): this {
    this.worldState.gravity = gravity;
    return this;
  }

  build(): StateSnapshot {
    const hash = this.computeHash();

    return {
      version: this.version,
      timestamp: this.timestamp,
      step: this.step,
      entities: new Map(this.entities),
      worldState: {
        ...this.worldState,
        activeEntityCount: this.entities.size,
      },
      hash,
    };
  }

  private computeHash(): string {
    // Simple deterministic hash based on state
    let hash = 0;
    const str = JSON.stringify({
      step: this.step,
      entityCount: this.entities.size,
      gravity: this.worldState.gravity,
    });

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}

// =============================================================================
// State Utilities
// =============================================================================

export function cloneState(state: StateSnapshot): StateSnapshot {
  return {
    version: state.version,
    timestamp: state.timestamp,
    step: state.step,
    entities: new Map(
      Array.from(state.entities.entries()).map(([id, entity]) => [
        id,
        { ...entity },
      ])
    ),
    worldState: { ...state.worldState },
    hash: state.hash,
  };
}

export function diffStates(
  before: StateSnapshot,
  after: StateSnapshot
): StateDiff {
  const added: EntityId[] = [];
  const removed: EntityId[] = [];
  const modified: EntityId[] = [];

  // Find added and modified
  for (const [id, afterEntity] of after.entities) {
    const beforeEntity = before.entities.get(id);
    if (!beforeEntity) {
      added.push(id);
    } else if (!entityStatesEqual(beforeEntity, afterEntity)) {
      modified.push(id);
    }
  }

  // Find removed
  for (const id of before.entities.keys()) {
    if (!after.entities.has(id)) {
      removed.push(id);
    }
  }

  return {
    stepDelta: after.step - before.step,
    timeDelta: after.timestamp - before.timestamp,
    added,
    removed,
    modified,
    collisionDelta: after.worldState.totalCollisions - before.worldState.totalCollisions,
  };
}

export interface StateDiff {
  stepDelta: number;
  timeDelta: number;
  added: EntityId[];
  removed: EntityId[];
  modified: EntityId[];
  collisionDelta: number;
}

function entityStatesEqual(a: EntityState, b: EntityState): boolean {
  if (a.status !== b.status) return false;

  const posEqual =
    a.transform.position.x === b.transform.position.x &&
    a.transform.position.y === b.transform.position.y &&
    a.transform.position.z === b.transform.position.z;

  if (!posEqual) return false;

  const velEqual =
    a.velocity.x === b.velocity.x &&
    a.velocity.y === b.velocity.y &&
    a.velocity.z === b.velocity.z;

  return velEqual;
}

// =============================================================================
// State Serialization
// =============================================================================

export interface SerializedState {
  v: number;
  ts: number;
  step: number;
  entities: Array<{
    id: string;
    pos: [number, number, number];
    rot: [number, number, number, number];
    vel: [number, number, number];
    status: string;
  }>;
  world: {
    time: number;
    gravity: [number, number, number];
    collisions: number;
  };
  hash: string;
}

export function serializeState(state: StateSnapshot): SerializedState {
  return {
    v: state.version,
    ts: state.timestamp,
    step: state.step,
    entities: Array.from(state.entities.values()).map(e => ({
      id: e.id,
      pos: [e.transform.position.x, e.transform.position.y, e.transform.position.z],
      rot: [e.transform.rotation.x, e.transform.rotation.y, e.transform.rotation.z, e.transform.rotation.w],
      vel: [e.velocity.x, e.velocity.y, e.velocity.z],
      status: e.status,
    })),
    world: {
      time: state.worldState.time,
      gravity: [state.worldState.gravity.x, state.worldState.gravity.y, state.worldState.gravity.z],
      collisions: state.worldState.totalCollisions,
    },
    hash: state.hash,
  };
}

export function deserializeState(data: SerializedState): StateSnapshot {
  const entities = new Map<EntityId, EntityState>();

  for (const e of data.entities) {
    entities.set(e.id as EntityId, {
      id: e.id as EntityId,
      transform: {
        position: { x: e.pos[0], y: e.pos[1], z: e.pos[2] },
        rotation: { x: e.rot[0], y: e.rot[1], z: e.rot[2], w: e.rot[3] },
        scale: { x: 1, y: 1, z: 1 },
      },
      velocity: { x: e.vel[0], y: e.vel[1], z: e.vel[2] },
      angularVelocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      status: e.status as EntityState['status'],
    });
  }

  return {
    version: data.v,
    timestamp: data.ts,
    step: data.step,
    entities,
    worldState: {
      time: data.world.time,
      gravity: { x: data.world.gravity[0], y: data.world.gravity[1], z: data.world.gravity[2] },
      bounds: {
        min: { x: -1000, y: -100, z: -1000 },
        max: { x: 1000, y: 1000, z: 1000 },
      },
      activeEntityCount: entities.size,
      totalCollisions: data.world.collisions,
    },
    hash: data.hash,
  };
}

