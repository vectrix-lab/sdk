/**
 * VECTRIX SDK Path Planning
 * @module @vectrix/sdk/pathfinding
 */

import type {
  Vector3,
  AABB,
  IPlanner,
  PlanRequest,
  PlanResult,
  PlannerConfig,
  PlannerAlgorithm,
} from '../core/types';
import { Vec3 } from '../world/transform';

// =============================================================================
// Types
// =============================================================================

export interface GridCell {
  x: number;
  y: number;
  z: number;
  walkable: boolean;
  cost: number;
}

export interface PathNode {
  position: Vector3;
  gCost: number;
  hCost: number;
  fCost: number;
  parent: PathNode | null;
}

export interface PathfindingGrid {
  width: number;
  height: number;
  depth: number;
  cellSize: number;
  cells: GridCell[][][];
}

// =============================================================================
// A* Pathfinder
// =============================================================================

export class AStarPlanner implements IPlanner {
  private config: PlannerConfig = {
    algorithm: 'astar',
    maxIterations: 10000,
    goalTolerance: 0.5,
    stepSize: 1,
  };

  private obstacles: AABB[] = [];

  setConfig(config: PlannerConfig): void {
    this.config = { ...this.config, ...config };
  }

  setObstacles(obstacles: AABB[]): void {
    this.obstacles = obstacles;
  }

  plan(start: Vector3, goal: Vector3, obstacles: AABB[]): Vector3[] | null {
    this.obstacles = obstacles;

    const maxIterations = this.config.maxIterations ?? 10000;
    const goalTolerance = this.config.goalTolerance ?? 0.5;
    const stepSize = this.config.stepSize ?? 1;

    // Create start and goal nodes
    const startNode: PathNode = {
      position: start,
      gCost: 0,
      hCost: this.heuristic(start, goal),
      fCost: this.heuristic(start, goal),
      parent: null,
    };

    const openSet: PathNode[] = [startNode];
    const closedSet = new Set<string>();
    let iterations = 0;

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;

      // Find node with lowest fCost
      openSet.sort((a, b) => a.fCost - b.fCost);
      const current = openSet.shift()!;

      // Check if reached goal
      if (Vec3.distance(current.position, goal) <= goalTolerance) {
        return this.reconstructPath(current);
      }

      const key = this.positionKey(current.position);
      if (closedSet.has(key)) continue;
      closedSet.add(key);

      // Generate neighbors
      const neighbors = this.getNeighbors(current.position, stepSize);

      for (const neighborPos of neighbors) {
        const neighborKey = this.positionKey(neighborPos);
        if (closedSet.has(neighborKey)) continue;

        // Check collision
        if (this.isBlocked(neighborPos)) continue;

        const gCost = current.gCost + Vec3.distance(current.position, neighborPos);
        const hCost = this.heuristic(neighborPos, goal);

        const neighborNode: PathNode = {
          position: neighborPos,
          gCost,
          hCost,
          fCost: gCost + hCost,
          parent: current,
        };

        // Check if already in open set with better cost
        const existing = openSet.find(n => this.positionKey(n.position) === neighborKey);
        if (existing && existing.fCost <= neighborNode.fCost) continue;

        openSet.push(neighborNode);
      }
    }

    return null; // No path found
  }

  planMulti(requests: PlanRequest[]): PlanResult[] {
    return requests.map(req => {
      const startTime = performance.now();
      const path = this.plan(req.start, req.goal, this.obstacles);
      const endTime = performance.now();

      return {
        entityId: req.entityId,
        success: path !== null,
        path,
        cost: path ? this.computePathCost(path) : 0,
        planningTimeMs: endTime - startTime,
      };
    });
  }

  private heuristic(a: Vector3, b: Vector3): number {
    // Euclidean distance
    return Vec3.distance(a, b);
  }

  private getNeighbors(position: Vector3, stepSize: number): Vector3[] {
    const neighbors: Vector3[] = [];
    const directions = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 },
      { x: 1, y: 0, z: 1 },
      { x: 1, y: 0, z: -1 },
      { x: -1, y: 0, z: 1 },
      { x: -1, y: 0, z: -1 },
      // Add vertical movement for 3D
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
    ];

    for (const dir of directions) {
      neighbors.push({
        x: position.x + dir.x * stepSize,
        y: position.y + dir.y * stepSize,
        z: position.z + dir.z * stepSize,
      });
    }

    return neighbors;
  }

  private isBlocked(position: Vector3): boolean {
    // Check against all obstacles
    for (const obstacle of this.obstacles) {
      if (this.pointInAABB(position, obstacle)) {
        return true;
      }
    }
    return false;
  }

  private pointInAABB(point: Vector3, aabb: AABB): boolean {
    return (
      point.x >= aabb.min.x && point.x <= aabb.max.x &&
      point.y >= aabb.min.y && point.y <= aabb.max.y &&
      point.z >= aabb.min.z && point.z <= aabb.max.z
    );
  }

  private positionKey(pos: Vector3): string {
    // Round to avoid floating point issues
    const precision = 100;
    const x = Math.round(pos.x * precision);
    const y = Math.round(pos.y * precision);
    const z = Math.round(pos.z * precision);
    return `${x},${y},${z}`;
  }

  private reconstructPath(node: PathNode): Vector3[] {
    const path: Vector3[] = [];
    let current: PathNode | null = node;

    while (current) {
      path.unshift(current.position);
      current = current.parent;
    }

    return this.smoothPath(path);
  }

  private smoothPath(path: Vector3[]): Vector3[] {
    if (path.length <= 2) return path;

    // Simple path smoothing - remove redundant waypoints
    const smoothed: Vector3[] = [path[0]!];

    for (let i = 1; i < path.length - 1; i++) {
      const prev = smoothed[smoothed.length - 1]!;
      const current = path[i]!;
      const next = path[i + 1]!;

      // Check if we can skip this waypoint
      if (!this.hasLineOfSight(prev, next)) {
        smoothed.push(current);
      }
    }

    smoothed.push(path[path.length - 1]!);
    return smoothed;
  }

  private hasLineOfSight(a: Vector3, b: Vector3): boolean {
    const steps = Math.ceil(Vec3.distance(a, b));
    if (steps === 0) return true;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = Vec3.lerp(a, b, t);
      if (this.isBlocked(point)) return false;
    }
    return true;
  }

  private computePathCost(path: Vector3[]): number {
    let cost = 0;
    for (let i = 1; i < path.length; i++) {
      cost += Vec3.distance(path[i - 1]!, path[i]!);
    }
    return cost;
  }
}

// =============================================================================
// RRT Planner (Rapidly-exploring Random Tree)
// =============================================================================

export class RRTPlanner implements IPlanner {
  private config: PlannerConfig = {
    algorithm: 'rrt',
    maxIterations: 5000,
    goalTolerance: 1.0,
    stepSize: 2,
  };

  private obstacles: AABB[] = [];
  private bounds: AABB = {
    min: { x: -100, y: 0, z: -100 },
    max: { x: 100, y: 50, z: 100 },
  };

  setConfig(config: PlannerConfig): void {
    this.config = { ...this.config, ...config };
  }

  setBounds(bounds: AABB): void {
    this.bounds = bounds;
  }

  plan(start: Vector3, goal: Vector3, obstacles: AABB[]): Vector3[] | null {
    this.obstacles = obstacles;

    const tree: PathNode[] = [{
      position: start,
      gCost: 0,
      hCost: 0,
      fCost: 0,
      parent: null,
    }];

    const maxIterations = this.config.maxIterations ?? 5000;
    const stepSize = this.config.stepSize ?? 2;
    const goalTolerance = this.config.goalTolerance ?? 1.0;
    const goalBias = 0.1; // 10% chance to sample goal directly

    for (let i = 0; i < maxIterations; i++) {
      // Sample random point (with goal bias)
      const sample = Math.random() < goalBias
        ? goal
        : this.randomSample();

      // Find nearest node in tree
      const nearest = this.findNearest(tree, sample);

      // Extend towards sample
      const direction = Vec3.normalize(Vec3.sub(sample, nearest.position));
      const newPos = Vec3.add(nearest.position, Vec3.mul(direction, stepSize));

      // Check collision
      if (this.isPathBlocked(nearest.position, newPos)) continue;

      const newNode: PathNode = {
        position: newPos,
        gCost: nearest.gCost + stepSize,
        hCost: Vec3.distance(newPos, goal),
        fCost: 0,
        parent: nearest,
      };

      tree.push(newNode);

      // Check if reached goal
      if (Vec3.distance(newPos, goal) <= goalTolerance) {
        return this.reconstructRRTPath(newNode, goal);
      }
    }

    // Try to connect to closest node
    const closest = this.findNearest(tree, goal);
    if (Vec3.distance(closest.position, goal) <= goalTolerance * 3) {
      return this.reconstructRRTPath(closest, goal);
    }

    return null;
  }

  planMulti(requests: PlanRequest[]): PlanResult[] {
    return requests.map(req => {
      const startTime = performance.now();
      const path = this.plan(req.start, req.goal, this.obstacles);
      const endTime = performance.now();

      return {
        entityId: req.entityId,
        success: path !== null,
        path,
        cost: path ? this.computePathCost(path) : 0,
        planningTimeMs: endTime - startTime,
      };
    });
  }

  private randomSample(): Vector3 {
    return {
      x: this.bounds.min.x + Math.random() * (this.bounds.max.x - this.bounds.min.x),
      y: this.bounds.min.y + Math.random() * (this.bounds.max.y - this.bounds.min.y),
      z: this.bounds.min.z + Math.random() * (this.bounds.max.z - this.bounds.min.z),
    };
  }

  private findNearest(tree: PathNode[], target: Vector3): PathNode {
    let nearest = tree[0]!;
    let minDist = Vec3.distance(nearest.position, target);

    for (const node of tree) {
      const dist = Vec3.distance(node.position, target);
      if (dist < minDist) {
        minDist = dist;
        nearest = node;
      }
    }

    return nearest;
  }

  private isPathBlocked(from: Vector3, to: Vector3): boolean {
    const steps = Math.ceil(Vec3.distance(from, to));
    for (let i = 0; i <= steps; i++) {
      const t = i / Math.max(steps, 1);
      const point = Vec3.lerp(from, to, t);
      for (const obstacle of this.obstacles) {
        if (this.pointInAABB(point, obstacle)) {
          return true;
        }
      }
    }
    return false;
  }

  private pointInAABB(point: Vector3, aabb: AABB): boolean {
    return (
      point.x >= aabb.min.x && point.x <= aabb.max.x &&
      point.y >= aabb.min.y && point.y <= aabb.max.y &&
      point.z >= aabb.min.z && point.z <= aabb.max.z
    );
  }

  private reconstructRRTPath(node: PathNode, goal: Vector3): Vector3[] {
    const path: Vector3[] = [];
    let current: PathNode | null = node;

    while (current) {
      path.unshift(current.position);
      current = current.parent;
    }

    // Add goal if not already there
    if (Vec3.distance(path[path.length - 1]!, goal) > 0.01) {
      path.push(goal);
    }

    return path;
  }

  private computePathCost(path: Vector3[]): number {
    let cost = 0;
    for (let i = 1; i < path.length; i++) {
      cost += Vec3.distance(path[i - 1]!, path[i]!);
    }
    return cost;
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createPlanner(algorithm: PlannerAlgorithm): IPlanner {
  switch (algorithm) {
    case 'astar':
    case 'dijkstra':
      return new AStarPlanner();
    case 'rrt':
    case 'rrt-star':
      return new RRTPlanner();
    default:
      return new AStarPlanner();
  }
}

// =============================================================================
// Path Utilities
// =============================================================================

export function validatePath(
  path: Vector3[],
  obstacles: AABB[],
  clearance = 0
): { valid: boolean; invalidSegment?: [number, number] } {
  if (path.length < 2) {
    return { valid: true };
  }

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!;
    const to = path[i]!;

    // Check segment for collisions
    const steps = Math.ceil(Vec3.distance(from, to));
    for (let s = 0; s <= steps; s++) {
      const t = s / Math.max(steps, 1);
      const point = Vec3.lerp(from, to, t);

      for (const obstacle of obstacles) {
        // Expand obstacle by clearance
        const expanded: AABB = {
          min: Vec3.sub(obstacle.min, { x: clearance, y: clearance, z: clearance }),
          max: Vec3.add(obstacle.max, { x: clearance, y: clearance, z: clearance }),
        };

        if (
          point.x >= expanded.min.x && point.x <= expanded.max.x &&
          point.y >= expanded.min.y && point.y <= expanded.max.y &&
          point.z >= expanded.min.z && point.z <= expanded.max.z
        ) {
          return { valid: false, invalidSegment: [i - 1, i] };
        }
      }
    }
  }

  return { valid: true };
}

export function interpolatePath(
  path: Vector3[],
  maxSegmentLength: number
): Vector3[] {
  if (path.length < 2) return path;

  const result: Vector3[] = [path[0]!];

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!;
    const to = path[i]!;
    const distance = Vec3.distance(from, to);
    const segments = Math.ceil(distance / maxSegmentLength);

    for (let s = 1; s <= segments; s++) {
      const t = s / segments;
      result.push(Vec3.lerp(from, to, t));
    }
  }

  return result;
}

