/**
 * VECTRIX SDK Physics Integrators
 * @module @vectrix/sdk/simulation
 */

import type { Vector3 } from '../core/types';
import { Vec3 } from '../world/transform';

// =============================================================================
// Types
// =============================================================================

export interface IntegratorState {
  position: Vector3;
  velocity: Vector3;
  acceleration: Vector3;
}

export interface IntegratorResult {
  position: Vector3;
  velocity: Vector3;
}

export interface Integrator {
  readonly name: string;
  readonly order: number;
  integrate(state: IntegratorState, dt: number): IntegratorResult;
}

// =============================================================================
// Euler Integrator (First Order)
// =============================================================================

export class EulerIntegrator implements Integrator {
  readonly name = 'euler';
  readonly order = 1;

  integrate(state: IntegratorState, dt: number): IntegratorResult {
    // Simple forward Euler: pos += vel * dt, vel += acc * dt
    const newVelocity = Vec3.add(state.velocity, Vec3.mul(state.acceleration, dt));
    const newPosition = Vec3.add(state.position, Vec3.mul(state.velocity, dt));

    return {
      position: newPosition,
      velocity: newVelocity,
    };
  }
}

// =============================================================================
// Semi-Implicit Euler (Symplectic Euler)
// =============================================================================

export class SemiImplicitEulerIntegrator implements Integrator {
  readonly name = 'semi-implicit-euler';
  readonly order = 1;

  integrate(state: IntegratorState, dt: number): IntegratorResult {
    // Update velocity first, then use new velocity for position
    const newVelocity = Vec3.add(state.velocity, Vec3.mul(state.acceleration, dt));
    const newPosition = Vec3.add(state.position, Vec3.mul(newVelocity, dt));

    return {
      position: newPosition,
      velocity: newVelocity,
    };
  }
}

// =============================================================================
// Velocity Verlet Integrator
// =============================================================================

export class VerletIntegrator implements Integrator {
  readonly name = 'verlet';
  readonly order = 2;

  private prevAcceleration: Vector3 = Vec3.zero();

  integrate(state: IntegratorState, dt: number): IntegratorResult {
    // Velocity Verlet integration
    // x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt^2
    // v(t+dt) = v(t) + 0.5*(a(t) + a(t+dt))*dt

    const dt2 = dt * dt;
    const halfDt = dt * 0.5;

    // Position update
    const velTerm = Vec3.mul(state.velocity, dt);
    const accTerm = Vec3.mul(state.acceleration, dt2 * 0.5);
    const newPosition = Vec3.add(Vec3.add(state.position, velTerm), accTerm);

    // Velocity update (using average acceleration)
    const avgAcc = Vec3.mul(Vec3.add(this.prevAcceleration, state.acceleration), halfDt);
    const newVelocity = Vec3.add(state.velocity, avgAcc);

    this.prevAcceleration = Vec3.clone(state.acceleration);

    return {
      position: newPosition,
      velocity: newVelocity,
    };
  }

  reset(): void {
    this.prevAcceleration = Vec3.zero();
  }
}

// =============================================================================
// Runge-Kutta 4 Integrator
// =============================================================================

export class RK4Integrator implements Integrator {
  readonly name = 'rk4';
  readonly order = 4;

  integrate(state: IntegratorState, dt: number): IntegratorResult {
    // RK4 integration for position and velocity
    // We assume constant acceleration within the timestep (simplified)

    const k1v = Vec3.mul(state.acceleration, dt);
    const k1p = Vec3.mul(state.velocity, dt);

    const k2v = Vec3.mul(state.acceleration, dt);
    const k2p = Vec3.mul(Vec3.add(state.velocity, Vec3.mul(k1v, 0.5)), dt);

    const k3v = Vec3.mul(state.acceleration, dt);
    const k3p = Vec3.mul(Vec3.add(state.velocity, Vec3.mul(k2v, 0.5)), dt);

    const k4v = Vec3.mul(state.acceleration, dt);
    const k4p = Vec3.mul(Vec3.add(state.velocity, k3v), dt);

    // Combine contributions
    const dv = Vec3.mul(Vec3.add(Vec3.add(k1v, Vec3.mul(k2v, 2)), Vec3.add(Vec3.mul(k3v, 2), k4v)), 1/6);
    const dp = Vec3.mul(Vec3.add(Vec3.add(k1p, Vec3.mul(k2p, 2)), Vec3.add(Vec3.mul(k3p, 2), k4p)), 1/6);

    return {
      position: Vec3.add(state.position, dp),
      velocity: Vec3.add(state.velocity, dv),
    };
  }
}

// =============================================================================
// Factory
// =============================================================================

export type IntegratorType = 'euler' | 'semi-implicit-euler' | 'verlet' | 'rk4';

export function createIntegrator(type: IntegratorType): Integrator {
  switch (type) {
    case 'euler':
      return new EulerIntegrator();
    case 'semi-implicit-euler':
      return new SemiImplicitEulerIntegrator();
    case 'verlet':
      return new VerletIntegrator();
    case 'rk4':
      return new RK4Integrator();
    default:
      return new SemiImplicitEulerIntegrator();
  }
}

// =============================================================================
// Stability Checks
// =============================================================================

export interface StabilityResult {
  stable: boolean;
  maxVelocity: number;
  maxAcceleration: number;
  hasNaN: boolean;
  hasInfinity: boolean;
  divergenceDetected: boolean;
}

export function checkStability(
  states: IntegratorState[],
  thresholds?: {
    maxVelocity?: number;
    maxAcceleration?: number;
  }
): StabilityResult {
  const maxVel = thresholds?.maxVelocity ?? 1000;
  const maxAcc = thresholds?.maxAcceleration ?? 10000;

  let highestVel = 0;
  let highestAcc = 0;
  let hasNaN = false;
  let hasInfinity = false;

  for (const state of states) {
    // Check for NaN
    if (Vec3.isNaN(state.position) || Vec3.isNaN(state.velocity) || Vec3.isNaN(state.acceleration)) {
      hasNaN = true;
    }

    // Check for Infinity
    if (!Vec3.isFinite(state.position) || !Vec3.isFinite(state.velocity) || !Vec3.isFinite(state.acceleration)) {
      hasInfinity = true;
    }

    // Track max values
    const velMag = Vec3.length(state.velocity);
    const accMag = Vec3.length(state.acceleration);

    if (velMag > highestVel) highestVel = velMag;
    if (accMag > highestAcc) highestAcc = accMag;
  }

  const velocityOk = highestVel <= maxVel;
  const accelerationOk = highestAcc <= maxAcc;
  const stable = velocityOk && accelerationOk && !hasNaN && !hasInfinity;

  return {
    stable,
    maxVelocity: highestVel,
    maxAcceleration: highestAcc,
    hasNaN,
    hasInfinity,
    divergenceDetected: !stable,
  };
}

// =============================================================================
// Energy Conservation Check
// =============================================================================

export function computeKineticEnergy(mass: number, velocity: Vector3): number {
  const speedSq = Vec3.lengthSq(velocity);
  return 0.5 * mass * speedSq;
}

export function computePotentialEnergy(mass: number, height: number, gravity = 9.81): number {
  return mass * gravity * height;
}

export function checkEnergyConservation(
  initialEnergy: number,
  currentEnergy: number,
  tolerance = 0.01
): { conserved: boolean; drift: number; driftPercent: number } {
  const drift = Math.abs(currentEnergy - initialEnergy);
  const driftPercent = initialEnergy > 0 ? drift / initialEnergy : drift;

  return {
    conserved: driftPercent <= tolerance,
    drift,
    driftPercent,
  };
}

