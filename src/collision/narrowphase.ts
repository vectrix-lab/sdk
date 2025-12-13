/**
 * VECTRIX SDK Collision Narrowphase
 * @module @vectrix/sdk/collision
 */

import type { EntityId, Vector3, AABB, CollisionEvent, CollisionType } from '../core/types';
import { Vec3 } from '../world/transform';

// =============================================================================
// Types
// =============================================================================

export interface NarrowphaseResult {
  colliding: boolean;
  contactPoint?: Vector3;
  contactNormal?: Vector3;
  penetrationDepth?: number;
}

export interface Collider {
  id: EntityId;
  type: ColliderType;
  center: Vector3;
  data: ColliderData;
}

export type ColliderType = 'sphere' | 'aabb' | 'capsule' | 'cylinder';

export type ColliderData = SphereCollider | AABBCollider | CapsuleCollider | CylinderCollider;

export interface SphereCollider {
  type: 'sphere';
  radius: number;
}

export interface AABBCollider {
  type: 'aabb';
  halfExtents: Vector3;
}

export interface CapsuleCollider {
  type: 'capsule';
  radius: number;
  height: number;
}

export interface CylinderCollider {
  type: 'cylinder';
  radius: number;
  height: number;
}

// =============================================================================
// Narrowphase Tests
// =============================================================================

/**
 * Sphere vs Sphere collision test
 */
export function sphereVsSphere(
  centerA: Vector3,
  radiusA: number,
  centerB: Vector3,
  radiusB: number
): NarrowphaseResult {
  const delta = Vec3.sub(centerB, centerA);
  const distanceSq = Vec3.lengthSq(delta);
  const radiusSum = radiusA + radiusB;
  const radiusSumSq = radiusSum * radiusSum;

  if (distanceSq >= radiusSumSq) {
    return { colliding: false };
  }

  const distance = Math.sqrt(distanceSq);
  const normal = distance > 0 ? Vec3.div(delta, distance) : { x: 1, y: 0, z: 0 };
  const penetration = radiusSum - distance;

  return {
    colliding: true,
    contactPoint: Vec3.add(centerA, Vec3.mul(normal, radiusA - penetration / 2)),
    contactNormal: normal,
    penetrationDepth: penetration,
  };
}

/**
 * AABB vs AABB collision test
 */
export function aabbVsAabb(boundsA: AABB, boundsB: AABB): NarrowphaseResult {
  // Check for separation on each axis
  if (
    boundsA.max.x < boundsB.min.x || boundsA.min.x > boundsB.max.x ||
    boundsA.max.y < boundsB.min.y || boundsA.min.y > boundsB.max.y ||
    boundsA.max.z < boundsB.min.z || boundsA.min.z > boundsB.max.z
  ) {
    return { colliding: false };
  }

  // Find overlap on each axis
  const overlapX = Math.min(boundsA.max.x - boundsB.min.x, boundsB.max.x - boundsA.min.x);
  const overlapY = Math.min(boundsA.max.y - boundsB.min.y, boundsB.max.y - boundsA.min.y);
  const overlapZ = Math.min(boundsA.max.z - boundsB.min.z, boundsB.max.z - boundsA.min.z);

  // Find minimum overlap axis
  let normal: Vector3;
  let penetration: number;

  if (overlapX <= overlapY && overlapX <= overlapZ) {
    penetration = overlapX;
    const centerA = (boundsA.min.x + boundsA.max.x) / 2;
    const centerB = (boundsB.min.x + boundsB.max.x) / 2;
    normal = { x: centerA < centerB ? -1 : 1, y: 0, z: 0 };
  } else if (overlapY <= overlapZ) {
    penetration = overlapY;
    const centerA = (boundsA.min.y + boundsA.max.y) / 2;
    const centerB = (boundsB.min.y + boundsB.max.y) / 2;
    normal = { x: 0, y: centerA < centerB ? -1 : 1, z: 0 };
  } else {
    penetration = overlapZ;
    const centerA = (boundsA.min.z + boundsA.max.z) / 2;
    const centerB = (boundsB.min.z + boundsB.max.z) / 2;
    normal = { x: 0, y: 0, z: centerA < centerB ? -1 : 1 };
  }

  // Approximate contact point (center of overlap region)
  const contactPoint: Vector3 = {
    x: (Math.max(boundsA.min.x, boundsB.min.x) + Math.min(boundsA.max.x, boundsB.max.x)) / 2,
    y: (Math.max(boundsA.min.y, boundsB.min.y) + Math.min(boundsA.max.y, boundsB.max.y)) / 2,
    z: (Math.max(boundsA.min.z, boundsB.min.z) + Math.min(boundsA.max.z, boundsB.max.z)) / 2,
  };

  return {
    colliding: true,
    contactPoint,
    contactNormal: normal,
    penetrationDepth: penetration,
  };
}

/**
 * Sphere vs AABB collision test
 */
export function sphereVsAabb(
  center: Vector3,
  radius: number,
  bounds: AABB
): NarrowphaseResult {
  // Find closest point on AABB to sphere center
  const closest: Vector3 = {
    x: Math.max(bounds.min.x, Math.min(center.x, bounds.max.x)),
    y: Math.max(bounds.min.y, Math.min(center.y, bounds.max.y)),
    z: Math.max(bounds.min.z, Math.min(center.z, bounds.max.z)),
  };

  const delta = Vec3.sub(center, closest);
  const distanceSq = Vec3.lengthSq(delta);

  if (distanceSq >= radius * radius) {
    return { colliding: false };
  }

  const distance = Math.sqrt(distanceSq);
  const normal = distance > 0 ? Vec3.div(delta, distance) : { x: 0, y: 1, z: 0 };
  const penetration = radius - distance;

  return {
    colliding: true,
    contactPoint: closest,
    contactNormal: normal,
    penetrationDepth: penetration,
  };
}

/**
 * Point vs Sphere test
 */
export function pointInSphere(point: Vector3, center: Vector3, radius: number): boolean {
  return Vec3.distanceSq(point, center) <= radius * radius;
}

/**
 * Point vs AABB test
 */
export function pointInAabb(point: Vector3, bounds: AABB): boolean {
  return (
    point.x >= bounds.min.x && point.x <= bounds.max.x &&
    point.y >= bounds.min.y && point.y <= bounds.max.y &&
    point.z >= bounds.min.z && point.z <= bounds.max.z
  );
}

// =============================================================================
// Raycast
// =============================================================================

export interface RaycastResult {
  hit: boolean;
  distance?: number;
  point?: Vector3;
  normal?: Vector3;
  entityId?: EntityId;
}

export function raycastSphere(
  origin: Vector3,
  direction: Vector3,
  center: Vector3,
  radius: number,
  maxDistance: number
): RaycastResult {
  const oc = Vec3.sub(origin, center);
  const a = Vec3.dot(direction, direction);
  const b = 2 * Vec3.dot(oc, direction);
  const c = Vec3.dot(oc, oc) - radius * radius;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return { hit: false };
  }

  const sqrtD = Math.sqrt(discriminant);
  let t = (-b - sqrtD) / (2 * a);

  if (t < 0) {
    t = (-b + sqrtD) / (2 * a);
  }

  if (t < 0 || t > maxDistance) {
    return { hit: false };
  }

  const point = Vec3.add(origin, Vec3.mul(direction, t));
  const normal = Vec3.normalize(Vec3.sub(point, center));

  return {
    hit: true,
    distance: t,
    point,
    normal,
  };
}

export function raycastAabb(
  origin: Vector3,
  direction: Vector3,
  bounds: AABB,
  maxDistance: number
): RaycastResult {
  const invDir: Vector3 = {
    x: direction.x !== 0 ? 1 / direction.x : Infinity,
    y: direction.y !== 0 ? 1 / direction.y : Infinity,
    z: direction.z !== 0 ? 1 / direction.z : Infinity,
  };

  const t1 = (bounds.min.x - origin.x) * invDir.x;
  const t2 = (bounds.max.x - origin.x) * invDir.x;
  const t3 = (bounds.min.y - origin.y) * invDir.y;
  const t4 = (bounds.max.y - origin.y) * invDir.y;
  const t5 = (bounds.min.z - origin.z) * invDir.z;
  const t6 = (bounds.max.z - origin.z) * invDir.z;

  const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
  const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));

  if (tmax < 0 || tmin > tmax || tmin > maxDistance) {
    return { hit: false };
  }

  const t = tmin >= 0 ? tmin : tmax;
  const point = Vec3.add(origin, Vec3.mul(direction, t));

  // Determine normal based on which face was hit
  let normal: Vector3 = { x: 0, y: 0, z: 0 };
  const epsilon = 0.0001;

  if (Math.abs(point.x - bounds.min.x) < epsilon) normal = { x: -1, y: 0, z: 0 };
  else if (Math.abs(point.x - bounds.max.x) < epsilon) normal = { x: 1, y: 0, z: 0 };
  else if (Math.abs(point.y - bounds.min.y) < epsilon) normal = { x: 0, y: -1, z: 0 };
  else if (Math.abs(point.y - bounds.max.y) < epsilon) normal = { x: 0, y: 1, z: 0 };
  else if (Math.abs(point.z - bounds.min.z) < epsilon) normal = { x: 0, y: 0, z: -1 };
  else normal = { x: 0, y: 0, z: 1 };

  return {
    hit: true,
    distance: t,
    point,
    normal,
  };
}

// =============================================================================
// Contact Event Builder
// =============================================================================

export function createCollisionEvent(
  entityA: EntityId,
  entityB: EntityId,
  result: NarrowphaseResult,
  step: number,
  timestamp: number,
  type: CollisionType = 'contact'
): CollisionEvent {
  return {
    timestamp,
    step,
    entityA,
    entityB,
    contactPoint: result.contactPoint ?? { x: 0, y: 0, z: 0 },
    contactNormal: result.contactNormal ?? { x: 0, y: 1, z: 0 },
    penetrationDepth: result.penetrationDepth ?? 0,
    impulse: 0, // Computed by response system
    type,
  };
}

// Edge case fixes applied
// Edge case fixes
