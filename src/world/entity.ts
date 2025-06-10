/**
 * VECTRIX SDK Entity Classes
 * @module @vectrix/sdk/world
 */

import type {
  EntityId,
  EntityDescriptor,
  EntityType,
  EntityProperties,
  EntityState,
  EntityStatus,
  Transform,
  Vector3,
  Quaternion,
  AABB,
} from '../core/types';

// =============================================================================
// Entity Base Class
// =============================================================================

export abstract class Entity {
  public readonly id: EntityId;
  public readonly type: EntityType;
  protected _transform: Transform;
  protected _properties: EntityProperties;
  protected _status: EntityStatus = 'idle';
  protected _velocity: Vector3 = { x: 0, y: 0, z: 0 };
  protected _angularVelocity: Vector3 = { x: 0, y: 0, z: 0 };
  protected _metadata: Record<string, unknown> = {};

  constructor(descriptor: EntityDescriptor) {
    this.id = descriptor.id;
    this.type = descriptor.type;
    this._transform = { ...descriptor.transform };
    this._properties = { ...descriptor.properties };
    if (descriptor.metadata) {
      this._metadata = { ...descriptor.metadata };
    }
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  get transform(): Readonly<Transform> {
    return this._transform;
  }

  get position(): Readonly<Vector3> {
    return this._transform.position;
  }

  get rotation(): Readonly<Quaternion> {
    return this._transform.rotation;
  }

  get scale(): Readonly<Vector3> {
    return this._transform.scale;
  }

  get properties(): Readonly<EntityProperties> {
    return this._properties;
  }

  get status(): EntityStatus {
    return this._status;
  }

  get velocity(): Readonly<Vector3> {
    return this._velocity;
  }

  get angularVelocity(): Readonly<Vector3> {
    return this._angularVelocity;
  }

  get metadata(): Readonly<Record<string, unknown>> {
    return this._metadata;
  }

  // ===========================================================================
  // State
  // ===========================================================================

  getState(): EntityState {
    return {
      id: this.id,
      transform: { ...this._transform },
      velocity: { ...this._velocity },
      angularVelocity: { ...this._angularVelocity },
      acceleration: { x: 0, y: 0, z: 0 },
      status: this._status,
      customState: { ...this._metadata },
    };
  }

  getDescriptor(): EntityDescriptor {
    return {
      id: this.id,
      type: this.type,
      transform: { ...this._transform },
      properties: { ...this._properties },
      metadata: { ...this._metadata },
    };
  }

  getBounds(): AABB {
    const radius = this._properties.collisionRadius ?? 1;
    const pos = this._transform.position;
    return {
      min: { x: pos.x - radius, y: pos.y - radius, z: pos.z - radius },
      max: { x: pos.x + radius, y: pos.y + radius, z: pos.z + radius },
    };
  }

  // ===========================================================================
  // Setters (for internal use)
  // ===========================================================================

  setPosition(position: Vector3): void {
    this._transform.position = { ...position };
  }

  setRotation(rotation: Quaternion): void {
    this._transform.rotation = { ...rotation };
  }

  setVelocity(velocity: Vector3): void {
    this._velocity = { ...velocity };
  }

  setAngularVelocity(angularVelocity: Vector3): void {
    this._angularVelocity = { ...angularVelocity };
  }

  setStatus(status: EntityStatus): void {
    this._status = status;
  }

  setMetadata(key: string, value: unknown): void {
    this._metadata[key] = value;
  }

  // ===========================================================================
  // Abstract Methods
  // ===========================================================================

  abstract clone(): Entity;
}

// =============================================================================
// Concrete Entity Types
// =============================================================================

export class DroneEntity extends Entity {
  public readonly maxAltitude: number;
  public readonly hoverStability: number;

  constructor(
    descriptor: EntityDescriptor,
    options?: { maxAltitude?: number; hoverStability?: number }
  ) {
    super(descriptor);
    this.maxAltitude = options?.maxAltitude ?? 500;
    this.hoverStability = options?.hoverStability ?? 0.95;
  }

  clone(): DroneEntity {
    return new DroneEntity(this.getDescriptor(), {
      maxAltitude: this.maxAltitude,
      hoverStability: this.hoverStability,
    });
  }
}

export class RobotEntity extends Entity {
  public readonly wheelBase: number;
  public readonly turningRadius: number;

  constructor(
    descriptor: EntityDescriptor,
    options?: { wheelBase?: number; turningRadius?: number }
  ) {
    super(descriptor);
    this.wheelBase = options?.wheelBase ?? 1.2;
    this.turningRadius = options?.turningRadius ?? 2.5;
  }

  clone(): RobotEntity {
    return new RobotEntity(this.getDescriptor(), {
      wheelBase: this.wheelBase,
      turningRadius: this.turningRadius,
    });
  }
}

export class VehicleEntity extends Entity {
  public readonly wheelBase: number;
  public readonly trackWidth: number;
  public readonly steeringAngleMax: number;

  constructor(
    descriptor: EntityDescriptor,
    options?: { wheelBase?: number; trackWidth?: number; steeringAngleMax?: number }
  ) {
    super(descriptor);
    this.wheelBase = options?.wheelBase ?? 2.8;
    this.trackWidth = options?.trackWidth ?? 1.6;
    this.steeringAngleMax = options?.steeringAngleMax ?? Math.PI / 4;
  }

  clone(): VehicleEntity {
    return new VehicleEntity(this.getDescriptor(), {
      wheelBase: this.wheelBase,
      trackWidth: this.trackWidth,
      steeringAngleMax: this.steeringAngleMax,
    });
  }
}

export class PedestrianEntity extends Entity {
  public readonly walkingSpeed: number;
  public readonly reactionTime: number;

  constructor(
    descriptor: EntityDescriptor,
    options?: { walkingSpeed?: number; reactionTime?: number }
  ) {
    super(descriptor);
    this.walkingSpeed = options?.walkingSpeed ?? 1.4;
    this.reactionTime = options?.reactionTime ?? 0.5;
  }

  clone(): PedestrianEntity {
    return new PedestrianEntity(this.getDescriptor(), {
      walkingSpeed: this.walkingSpeed,
      reactionTime: this.reactionTime,
    });
  }
}

export class ObstacleEntity extends Entity {
  public readonly isStatic: boolean;

  constructor(descriptor: EntityDescriptor, isStatic = true) {
    super(descriptor);
    this.isStatic = isStatic;
    this._status = 'idle';
  }

  clone(): ObstacleEntity {
    return new ObstacleEntity(this.getDescriptor(), this.isStatic);
  }
}

// =============================================================================
// Entity Factory
// =============================================================================

export function createEntity(descriptor: EntityDescriptor): Entity {
  switch (descriptor.type) {
    case 'drone':
      return new DroneEntity(descriptor);
    case 'robot':
      return new RobotEntity(descriptor);
    case 'vehicle':
      return new VehicleEntity(descriptor);
    case 'pedestrian':
      return new PedestrianEntity(descriptor);
    case 'obstacle':
      return new ObstacleEntity(descriptor);
    default:
      return new ObstacleEntity(descriptor, false);
  }
}

// =============================================================================
// Entity ID Generation
// =============================================================================

let entityCounter = 0;

export function generateEntityId(prefix = 'ent'): EntityId {
  const timestamp = Date.now().toString(36);
  const counter = (entityCounter++).toString(36).padStart(4, '0');
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${timestamp}${counter}${random}` as EntityId;
}

export function resetEntityCounter(): void {
  entityCounter = 0;
}

