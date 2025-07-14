/**
 * VECTRIX SDK Contact Resolution
 * @module @vectrix/sdk/collision
 */

import type { Vector3, EntityId, CollisionEvent } from '../core/types';
import { Vec3 } from '../world/transform';

// =============================================================================
// Types
// =============================================================================

export interface ContactManifold {
  entityA: EntityId;
  entityB: EntityId;
  contacts: ContactPoint[];
  friction: number;
  restitution: number;
}

export interface ContactPoint {
  position: Vector3;
  normal: Vector3;
  penetration: number;
  impulse: number;
  tangentImpulse: Vector3;
}

export interface PhysicsBody {
  id: EntityId;
  position: Vector3;
  velocity: Vector3;
  angularVelocity: Vector3;
  mass: number;
  inverseMass: number;
  friction: number;
  restitution: number;
  isStatic: boolean;
}

export interface ContactResolutionResult {
  bodyA: { velocity: Vector3; position: Vector3 };
  bodyB: { velocity: Vector3; position: Vector3 };
  impulse: number;
}

// =============================================================================
// Contact Resolution
// =============================================================================

/**
 * Resolve collision between two bodies using impulse-based resolution
 */
export function resolveContact(
  bodyA: PhysicsBody,
  bodyB: PhysicsBody,
  contact: ContactPoint
): ContactResolutionResult {
  // Skip if both are static
  if (bodyA.isStatic && bodyB.isStatic) {
    return {
      bodyA: { velocity: bodyA.velocity, position: bodyA.position },
      bodyB: { velocity: bodyB.velocity, position: bodyB.position },
      impulse: 0,
    };
  }

  const normal = contact.normal;

  // Relative velocity at contact point
  const relativeVelocity = Vec3.sub(bodyB.velocity, bodyA.velocity);
  const velocityAlongNormal = Vec3.dot(relativeVelocity, normal);

  // Don't resolve if velocities are separating
  if (velocityAlongNormal > 0) {
    return {
      bodyA: { velocity: bodyA.velocity, position: bodyA.position },
      bodyB: { velocity: bodyB.velocity, position: bodyB.position },
      impulse: 0,
    };
  }

  // Coefficient of restitution (bounciness)
  const e = Math.min(bodyA.restitution, bodyB.restitution);

  // Calculate impulse scalar
  const inverseMassSum = bodyA.inverseMass + bodyB.inverseMass;
  if (inverseMassSum === 0) {
    return {
      bodyA: { velocity: bodyA.velocity, position: bodyA.position },
      bodyB: { velocity: bodyB.velocity, position: bodyB.position },
      impulse: 0,
    };
  }

  let j = -(1 + e) * velocityAlongNormal;
  j /= inverseMassSum;

  // Apply impulse
  const impulse = Vec3.mul(normal, j);
  const newVelA = Vec3.sub(bodyA.velocity, Vec3.mul(impulse, bodyA.inverseMass));
  const newVelB = Vec3.add(bodyB.velocity, Vec3.mul(impulse, bodyB.inverseMass));

  // Position correction (prevent sinking)
  const percent = 0.8; // Penetration percentage to correct
  const slop = 0.01; // Penetration allowance
  const correction = Vec3.mul(
    normal,
    (Math.max(contact.penetration - slop, 0) / inverseMassSum) * percent
  );

  const newPosA = bodyA.isStatic
    ? bodyA.position
    : Vec3.sub(bodyA.position, Vec3.mul(correction, bodyA.inverseMass));
  const newPosB = bodyB.isStatic
    ? bodyB.position
    : Vec3.add(bodyB.position, Vec3.mul(correction, bodyB.inverseMass));

  return {
    bodyA: { velocity: newVelA, position: newPosA },
    bodyB: { velocity: newVelB, position: newPosB },
    impulse: j,
  };
}

/**
 * Apply friction to contact resolution
 */
export function applyFriction(
  bodyA: PhysicsBody,
  bodyB: PhysicsBody,
  contact: ContactPoint,
  normalImpulse: number
): { velocityA: Vector3; velocityB: Vector3 } {
  const normal = contact.normal;
  const relativeVelocity = Vec3.sub(bodyB.velocity, bodyA.velocity);

  // Calculate tangent (direction of friction)
  const tangent = Vec3.normalize(
    Vec3.sub(relativeVelocity, Vec3.mul(normal, Vec3.dot(relativeVelocity, normal)))
  );

  // Calculate friction impulse magnitude
  const velocityAlongTangent = Vec3.dot(relativeVelocity, tangent);
  const inverseMassSum = bodyA.inverseMass + bodyB.inverseMass;

  if (inverseMassSum === 0 || Vec3.isZero(tangent)) {
    return { velocityA: bodyA.velocity, velocityB: bodyB.velocity };
  }

  let jt = -velocityAlongTangent / inverseMassSum;

  // Coulomb friction
  const mu = Math.sqrt(bodyA.friction * bodyB.friction);
  const maxFriction = Math.abs(normalImpulse) * mu;

  if (Math.abs(jt) > maxFriction) {
    jt = jt > 0 ? maxFriction : -maxFriction;
  }

  // Apply friction impulse
  const frictionImpulse = Vec3.mul(tangent, jt);

  return {
    velocityA: Vec3.sub(bodyA.velocity, Vec3.mul(frictionImpulse, bodyA.inverseMass)),
    velocityB: Vec3.add(bodyB.velocity, Vec3.mul(frictionImpulse, bodyB.inverseMass)),
  };
}

// =============================================================================
// Contact Manager
// =============================================================================

export class ContactManager {
  private readonly manifolds = new Map<string, ContactManifold>();
  private readonly events: CollisionEvent[] = [];
  setStep(_step: number): void {
    // Step tracking for future use
  }

  addContact(
    entityA: EntityId,
    entityB: EntityId,
    contact: ContactPoint,
    friction: number,
    restitution: number
  ): void {
    const key = this.getManifoldKey(entityA, entityB);
    let manifold = this.manifolds.get(key);

    if (!manifold) {
      manifold = {
        entityA: entityA < entityB ? entityA : entityB,
        entityB: entityA < entityB ? entityB : entityA,
        contacts: [],
        friction,
        restitution,
      };
      this.manifolds.set(key, manifold);
    }

    manifold.contacts.push(contact);
  }

  getManifolds(): ContactManifold[] {
    return Array.from(this.manifolds.values());
  }

  getEvents(): CollisionEvent[] {
    return [...this.events];
  }

  recordEvent(event: CollisionEvent): void {
    this.events.push(event);
  }

  clear(): void {
    this.manifolds.clear();
  }

  clearEvents(): void {
    this.events.length = 0;
  }

  private getManifoldKey(a: EntityId, b: EntityId): string {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }
}

// =============================================================================
// Contact Callbacks
// =============================================================================

export type ContactCallback = (event: CollisionEvent) => void;

export class ContactCallbackRegistry {
  private readonly onEnter = new Map<EntityId, ContactCallback[]>();
  private readonly onStay = new Map<EntityId, ContactCallback[]>();
  private readonly onExit = new Map<EntityId, ContactCallback[]>();
  private readonly activeContacts = new Set<string>();

  registerOnEnter(entityId: EntityId, callback: ContactCallback): void {
    const callbacks = this.onEnter.get(entityId) ?? [];
    callbacks.push(callback);
    this.onEnter.set(entityId, callbacks);
  }

  registerOnStay(entityId: EntityId, callback: ContactCallback): void {
    const callbacks = this.onStay.get(entityId) ?? [];
    callbacks.push(callback);
    this.onStay.set(entityId, callbacks);
  }

  registerOnExit(entityId: EntityId, callback: ContactCallback): void {
    const callbacks = this.onExit.get(entityId) ?? [];
    callbacks.push(callback);
    this.onExit.set(entityId, callbacks);
  }

  processContacts(events: CollisionEvent[]): void {
    const currentContacts = new Set<string>();

    for (const event of events) {
      const key = `${event.entityA}:${event.entityB}`;
      currentContacts.add(key);

      if (!this.activeContacts.has(key)) {
        // New contact - trigger onEnter
        this.triggerCallbacks(this.onEnter, event);
        this.activeContacts.add(key);
      } else {
        // Existing contact - trigger onStay
        this.triggerCallbacks(this.onStay, event);
      }
    }

    // Check for ended contacts
    for (const key of this.activeContacts) {
      if (!currentContacts.has(key)) {
        const [entityA, entityB] = key.split(':') as [EntityId, EntityId];
        const exitEvent: CollisionEvent = {
          timestamp: Date.now(),
          step: 0,
          entityA,
          entityB,
          contactPoint: { x: 0, y: 0, z: 0 },
          contactNormal: { x: 0, y: 1, z: 0 },
          penetrationDepth: 0,
          impulse: 0,
          type: 'separation',
        };
        this.triggerCallbacks(this.onExit, exitEvent);
        this.activeContacts.delete(key);
      }
    }
  }

  private triggerCallbacks(
    registry: Map<EntityId, ContactCallback[]>,
    event: CollisionEvent
  ): void {
    const callbacksA = registry.get(event.entityA) ?? [];
    const callbacksB = registry.get(event.entityB) ?? [];

    for (const cb of callbacksA) cb(event);
    for (const cb of callbacksB) cb(event);
  }

  clear(): void {
    this.onEnter.clear();
    this.onStay.clear();
    this.onExit.clear();
    this.activeContacts.clear();
  }
}

