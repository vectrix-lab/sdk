/**
 * VECTRIX SDK Scenario Base
 * @module @vectrix/sdk/scenarios
 */

import type {
  ScenarioType,
  ScenarioBuildResult,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  EntityDescriptor,
  WorldConfig,
  Vector3,
  AABB,
} from '../core/types';
import { generateEntityId } from '../world/entity';

// =============================================================================
// Abstract Scenario
// =============================================================================

export abstract class Scenario {
  abstract readonly type: ScenarioType;
  abstract readonly config: object;

  abstract build(): ScenarioBuildResult;

  validate(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    this.validateConfig(errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  protected abstract validateConfig(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void;

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  protected createEntity(
    type: EntityDescriptor['type'],
    position: Vector3,
    properties?: Partial<EntityDescriptor['properties']>,
    metadata?: Record<string, unknown>
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
        ...properties,
      },
      metadata,
    };
  }

  protected createObstacle(
    position: Vector3,
    size: Vector3,
    metadata?: Record<string, unknown>
  ): EntityDescriptor {
    return this.createEntity(
      'obstacle',
      position,
      {
        mass: 0,
        collisionRadius: Math.max(size.x, size.y, size.z) / 2,
        customData: { size },
      },
      metadata
    );
  }

  protected createWorldConfig(
    size: Vector3,
    gravity: Vector3 = { x: 0, y: -9.81, z: 0 }
  ): WorldConfig {
    return {
      size,
      gravity,
      bounds: {
        min: { x: -size.x / 2, y: 0, z: -size.z / 2 },
        max: { x: size.x / 2, y: size.y, z: size.z / 2 },
      },
      gridResolution: 1,
    };
  }

  protected randomInBounds(bounds: AABB): Vector3 {
    return {
      x: bounds.min.x + Math.random() * (bounds.max.x - bounds.min.x),
      y: bounds.min.y + Math.random() * (bounds.max.y - bounds.min.y),
      z: bounds.min.z + Math.random() * (bounds.max.z - bounds.min.z),
    };
  }

  protected gridPositions(
    bounds: AABB,
    spacing: number
  ): Vector3[] {
    const positions: Vector3[] = [];
    for (let x = bounds.min.x; x <= bounds.max.x; x += spacing) {
      for (let z = bounds.min.z; z <= bounds.max.z; z += spacing) {
        positions.push({ x, y: bounds.min.y, z });
      }
    }
    return positions;
  }
}

// =============================================================================
// Scenario Validation Helpers
// =============================================================================

export function validatePositiveNumber(
  value: unknown,
  field: string,
  errors: ValidationError[]
): boolean {
  if (typeof value !== 'number' || value <= 0 || !Number.isFinite(value)) {
    errors.push({
      code: 'INVALID_NUMBER',
      message: `${field} must be a positive number`,
      field,
    });
    return false;
  }
  return true;
}

export function validateRange(
  value: unknown,
  field: string,
  min: number,
  max: number,
  errors: ValidationError[]
): boolean {
  if (typeof value !== 'number' || value < min || value > max) {
    errors.push({
      code: 'OUT_OF_RANGE',
      message: `${field} must be between ${min} and ${max}`,
      field,
    });
    return false;
  }
  return true;
}

export function validateVector3(
  value: unknown,
  field: string,
  errors: ValidationError[]
): boolean {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as Vector3).x !== 'number' ||
    typeof (value as Vector3).y !== 'number' ||
    typeof (value as Vector3).z !== 'number'
  ) {
    errors.push({
      code: 'INVALID_VECTOR',
      message: `${field} must be a valid Vector3 (x, y, z)`,
      field,
    });
    return false;
  }
  return true;
}

