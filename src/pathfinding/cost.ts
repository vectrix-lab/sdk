/**
 * VECTRIX SDK Path Cost Functions
 * @module @vectrix/sdk/pathfinding
 */

import type { Vector3, AABB } from '../core/types';
import { Vec3 } from '../world/transform';

// =============================================================================
// Types
// =============================================================================

export interface CostFunction {
  name: string;
  weight: number;
  evaluate(path: Vector3[], context: CostContext): number;
}

export interface CostContext {
  obstacles: AABB[];
  goal: Vector3;
  start: Vector3;
  maxVelocity?: number;
  preferredClearance?: number;
  timeLimit?: number;
}

export interface CostBreakdown {
  total: number;
  components: Record<string, number>;
}

// =============================================================================
// Standard Cost Functions
// =============================================================================

/**
 * Distance cost - penalizes longer paths
 */
export class DistanceCost implements CostFunction {
  name = 'distance';
  weight = 1.0;

  constructor(weight = 1.0) {
    this.weight = weight;
  }

  evaluate(path: Vector3[]): number {
    if (path.length < 2) return 0;

    let distance = 0;
    for (let i = 1; i < path.length; i++) {
      distance += Vec3.distance(path[i - 1]!, path[i]!);
    }

    return distance * this.weight;
  }
}

/**
 * Smoothness cost - penalizes sharp turns
 */
export class SmoothnessCost implements CostFunction {
  name = 'smoothness';
  weight = 0.5;

  constructor(weight = 0.5) {
    this.weight = weight;
  }

  evaluate(path: Vector3[], _context?: CostContext): number {
    if (path.length < 3) return 0;

    let totalAngle = 0;

    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1]!;
      const current = path[i]!;
      const next = path[i + 1]!;

      const dir1 = Vec3.normalize(Vec3.sub(current, prev));
      const dir2 = Vec3.normalize(Vec3.sub(next, current));

      const dot = Vec3.dot(dir1, dir2);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      totalAngle += angle;
    }

    return totalAngle * this.weight;
  }
}

/**
 * Clearance cost - penalizes paths close to obstacles
 */
export class ClearanceCost implements CostFunction {
  name = 'clearance';
  weight = 1.0;

  constructor(weight = 1.0) {
    this.weight = weight;
  }

  evaluate(path: Vector3[], context: CostContext): number {
    const preferredClearance = context.preferredClearance ?? 2;
    let totalPenalty = 0;

    for (const point of path) {
      let minDistance = Infinity;

      for (const obstacle of context.obstacles) {
        const distance = this.distanceToAABB(point, obstacle);
        minDistance = Math.min(minDistance, distance);
      }

      if (minDistance < preferredClearance) {
        const penalty = preferredClearance - minDistance;
        totalPenalty += penalty * penalty; // Quadratic penalty
      }
    }

    return totalPenalty * this.weight;
  }

  private distanceToAABB(point: Vector3, aabb: AABB): number {
    const closest: Vector3 = {
      x: Math.max(aabb.min.x, Math.min(point.x, aabb.max.x)),
      y: Math.max(aabb.min.y, Math.min(point.y, aabb.max.y)),
      z: Math.max(aabb.min.z, Math.min(point.z, aabb.max.z)),
    };
    return Vec3.distance(point, closest);
  }
}

/**
 * Time cost - estimates time to traverse path
 */
export class TimeCost implements CostFunction {
  name = 'time';
  weight = 1.0;

  constructor(weight = 1.0) {
    this.weight = weight;
  }

  evaluate(path: Vector3[], context: CostContext): number {
    const maxVelocity = context.maxVelocity ?? 10;
    const distance = new DistanceCost(1).evaluate(path);
    const time = distance / maxVelocity;

    // Add acceleration/deceleration time
    const accelerationTime = (path.length - 1) * 0.1;

    return (time + accelerationTime) * this.weight;
  }
}

/**
 * Goal error cost - penalizes paths that don't reach the goal
 */
export class GoalErrorCost implements CostFunction {
  name = 'goal_error';
  weight = 10.0;

  constructor(weight = 10.0) {
    this.weight = weight;
  }

  evaluate(path: Vector3[], context: CostContext): number {
    if (path.length === 0) return this.weight * 1000;

    const finalPoint = path[path.length - 1]!;
    const error = Vec3.distance(finalPoint, context.goal);

    return error * this.weight;
  }
}

/**
 * Energy cost - estimates energy consumption
 */
export class EnergyCost implements CostFunction {
  name = 'energy';
  weight = 0.3;

  constructor(weight = 0.3) {
    this.weight = weight;
  }

  evaluate(path: Vector3[], _context?: CostContext): number {
    if (path.length < 2) return 0;

    let energy = 0;

    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1]!;
      const current = path[i]!;

      // Horizontal movement cost
      const horizontal = Math.sqrt(
        Math.pow(current.x - prev.x, 2) +
        Math.pow(current.z - prev.z, 2)
      );
      energy += horizontal;

      // Vertical movement costs more (especially upward)
      const vertical = current.y - prev.y;
      if (vertical > 0) {
        energy += vertical * 2; // Climbing costs more
      } else {
        energy += Math.abs(vertical) * 0.5; // Descending is cheaper
      }
    }

    return energy * this.weight;
  }
}

// =============================================================================
// Cost Evaluator
// =============================================================================

export class CostEvaluator {
  private costFunctions: CostFunction[] = [];

  constructor(costFunctions?: CostFunction[]) {
    if (costFunctions) {
      this.costFunctions = costFunctions;
    } else {
      // Default cost functions
      this.costFunctions = [
        new DistanceCost(),
        new SmoothnessCost(),
        new ClearanceCost(),
      ];
    }
  }

  addCostFunction(costFunction: CostFunction): void {
    this.costFunctions.push(costFunction);
  }

  removeCostFunction(name: string): void {
    this.costFunctions = this.costFunctions.filter(cf => cf.name !== name);
  }

  setCostFunctions(costFunctions: CostFunction[]): void {
    this.costFunctions = costFunctions;
  }

  evaluate(path: Vector3[], context: CostContext): number {
    let totalCost = 0;
    for (const cf of this.costFunctions) {
      totalCost += cf.evaluate(path, context);
    }
    return totalCost;
  }

  evaluateBreakdown(path: Vector3[], context: CostContext): CostBreakdown {
    const components: Record<string, number> = {};
    let total = 0;

    for (const cf of this.costFunctions) {
      const cost = cf.evaluate(path, context);
      components[cf.name] = cost;
      total += cost;
    }

    return { total, components };
  }

  comparePaths(
    paths: Vector3[][],
    context: CostContext
  ): Array<{ path: Vector3[]; cost: number; breakdown: CostBreakdown }> {
    return paths
      .map(path => ({
        path,
        cost: this.evaluate(path, context),
        breakdown: this.evaluateBreakdown(path, context),
      }))
      .sort((a, b) => a.cost - b.cost);
  }
}

// =============================================================================
// Factory
// =============================================================================

export type CostFunctionType =
  | 'distance'
  | 'smoothness'
  | 'clearance'
  | 'time'
  | 'goal_error'
  | 'energy';

export function createCostFunction(type: CostFunctionType, weight = 1.0): CostFunction {
  switch (type) {
    case 'distance':
      return new DistanceCost(weight);
    case 'smoothness':
      return new SmoothnessCost(weight);
    case 'clearance':
      return new ClearanceCost(weight);
    case 'time':
      return new TimeCost(weight);
    case 'goal_error':
      return new GoalErrorCost(weight);
    case 'energy':
      return new EnergyCost(weight);
    default:
      return new DistanceCost(weight);
  }
}

export function createDefaultEvaluator(): CostEvaluator {
  return new CostEvaluator([
    new DistanceCost(1.0),
    new SmoothnessCost(0.5),
    new ClearanceCost(1.0),
    new GoalErrorCost(10.0),
  ]);
}

