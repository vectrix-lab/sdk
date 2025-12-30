/**
 * VECTRIX SDK Route Planning System
 * @module @vectrix/sdk/pathfinding
 */

import type {
  Vector3,
  Route,
  RouteWaypoint,
  Lane,
  RoadSegment,
  TrafficSignal,
  TrafficSign,
  AABB,
} from '../core/types';
import { Vec3 } from '../world/transform';

// =============================================================================
// Route Builder
// =============================================================================

export class RouteBuilder {
  private waypoints: RouteWaypoint[] = [];
  private routeId: string;
  private metadata: Record<string, unknown> = {};

  constructor(routeId?: string) {
    this.routeId = routeId ?? `route_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  addWaypoint(
    position: Vector3,
    options?: Partial<Omit<RouteWaypoint, 'id' | 'position'>>
  ): this {
    const waypoint: RouteWaypoint = {
      id: `wp_${this.waypoints.length}_${Math.random().toString(36).slice(2, 6)}`,
      position: Vec3.clone(position),
      heading: options?.heading ?? 0,
      speedLimit: options?.speedLimit,
      stopRequired: options?.stopRequired ?? false,
      waitTime: options?.waitTime,
      laneId: options?.laneId,
    };
    this.waypoints.push(waypoint);
    return this;
  }

  addStop(position: Vector3, waitTime: number, heading?: number): this {
    return this.addWaypoint(position, {
      stopRequired: true,
      waitTime,
      heading,
    });
  }

  setMetadata(key: string, value: unknown): this {
    this.metadata[key] = value;
    return this;
  }

  build(): Route {
    const totalDistance = this.calculateTotalDistance();
    const estimatedTime = this.calculateEstimatedTime();

    return {
      id: this.routeId,
      waypoints: [...this.waypoints],
      totalDistance,
      estimatedTime,
      metadata: { ...this.metadata },
    };
  }

  private calculateTotalDistance(): number {
    let distance = 0;
    for (let i = 1; i < this.waypoints.length; i++) {
      distance += Vec3.distance(
        this.waypoints[i - 1]!.position,
        this.waypoints[i]!.position
      );
    }
    return distance;
  }

  private calculateEstimatedTime(): number {
    let time = 0;
    const defaultSpeed = 10; // m/s

    for (let i = 1; i < this.waypoints.length; i++) {
      const prev = this.waypoints[i - 1]!;
      const curr = this.waypoints[i]!;
      const distance = Vec3.distance(prev.position, curr.position);
      const speed = prev.speedLimit ?? defaultSpeed;
      time += distance / speed;

      if (curr.stopRequired && curr.waitTime) {
        time += curr.waitTime;
      }
    }
    return time;
  }

  static fromPath(path: Vector3[], defaultSpeedLimit?: number): Route {
    const builder = new RouteBuilder();
    for (const point of path) {
      builder.addWaypoint(point, { speedLimit: defaultSpeedLimit });
    }
    return builder.build();
  }
}

// =============================================================================
// Road Network
// =============================================================================

export class RoadNetwork {
  private segments = new Map<string, RoadSegment>();
  private lanes = new Map<string, Lane>();
  private signals = new Map<string, TrafficSignal>();
  private signs = new Map<string, TrafficSign>();
  private nodeConnections = new Map<string, string[]>();

  addSegment(segment: RoadSegment): void {
    this.segments.set(segment.id, segment);

    for (const lane of segment.lanes) {
      this.lanes.set(lane.id, lane);
    }

    if (!this.nodeConnections.has(segment.startNode)) {
      this.nodeConnections.set(segment.startNode, []);
    }
    this.nodeConnections.get(segment.startNode)!.push(segment.id);

    if (!this.nodeConnections.has(segment.endNode)) {
      this.nodeConnections.set(segment.endNode, []);
    }
    this.nodeConnections.get(segment.endNode)!.push(segment.id);
  }

  addSignal(signal: TrafficSignal): void {
    this.signals.set(signal.id, signal);
  }

  addSign(sign: TrafficSign): void {
    this.signs.set(sign.id, sign);
  }

  getSegment(id: string): RoadSegment | undefined {
    return this.segments.get(id);
  }

  getLane(id: string): Lane | undefined {
    return this.lanes.get(id);
  }

  getSignal(id: string): TrafficSignal | undefined {
    return this.signals.get(id);
  }

  getSegmentsAtNode(nodeId: string): RoadSegment[] {
    const segmentIds = this.nodeConnections.get(nodeId) ?? [];
    return segmentIds
      .map(id => this.segments.get(id))
      .filter((s): s is RoadSegment => s !== undefined);
  }

  findNearestLane(position: Vector3, maxDistance = 50): Lane | null {
    let nearest: Lane | null = null;
    let minDist = maxDistance;

    for (const lane of this.lanes.values()) {
      const dist = this.distanceToLane(position, lane);
      if (dist < minDist) {
        minDist = dist;
        nearest = lane;
      }
    }

    return nearest;
  }

  findLanesInBounds(bounds: AABB): Lane[] {
    const result: Lane[] = [];
    for (const lane of this.lanes.values()) {
      if (this.laneIntersectsBounds(lane, bounds)) {
        result.push(lane);
      }
    }
    return result;
  }

  getSignalsNear(position: Vector3, radius: number): TrafficSignal[] {
    const result: TrafficSignal[] = [];
    for (const signal of this.signals.values()) {
      if (Vec3.distance(position, signal.position) <= radius) {
        result.push(signal);
      }
    }
    return result;
  }

  getSignsNear(position: Vector3, radius: number): TrafficSign[] {
    const result: TrafficSign[] = [];
    for (const sign of this.signs.values()) {
      if (Vec3.distance(position, sign.position) <= radius) {
        result.push(sign);
      }
    }
    return result;
  }

  getAllSegments(): RoadSegment[] {
    return Array.from(this.segments.values());
  }

  getAllLanes(): Lane[] {
    return Array.from(this.lanes.values());
  }

  getAllSignals(): TrafficSignal[] {
    return Array.from(this.signals.values());
  }

  getAllSigns(): TrafficSign[] {
    return Array.from(this.signs.values());
  }

  private distanceToLane(point: Vector3, lane: Lane): number {
    const ab = Vec3.sub(lane.endPosition, lane.startPosition);
    const ap = Vec3.sub(point, lane.startPosition);
    const abLenSq = Vec3.lengthSq(ab);

    if (abLenSq === 0) {
      return Vec3.distance(point, lane.startPosition);
    }

    let t = Vec3.dot(ap, ab) / abLenSq;
    t = Math.max(0, Math.min(1, t));

    const closest = Vec3.add(lane.startPosition, Vec3.mul(ab, t));
    return Vec3.distance(point, closest);
  }

  private laneIntersectsBounds(lane: Lane, bounds: AABB): boolean {
    const laneMin = Vec3.min(lane.startPosition, lane.endPosition);
    const laneMax = Vec3.max(lane.startPosition, lane.endPosition);

    return (
      laneMin.x <= bounds.max.x && laneMax.x >= bounds.min.x &&
      laneMin.y <= bounds.max.y && laneMax.y >= bounds.min.y &&
      laneMin.z <= bounds.max.z && laneMax.z >= bounds.min.z
    );
  }
}

// =============================================================================
// Route Follower
// =============================================================================

export interface RouteFollowerState {
  currentWaypointIndex: number;
  distanceToNextWaypoint: number;
  isWaiting: boolean;
  waitTimeRemaining: number;
  completed: boolean;
  progress: number;
}

export class RouteFollower {
  private route: Route;
  private currentIndex = 0;
  private waitTimeRemaining = 0;
  private completed = false;
  private traveledDistance = 0;

  constructor(route: Route) {
    this.route = route;
  }

  update(currentPosition: Vector3, dt: number): {
    targetPosition: Vector3;
    targetHeading: number;
    speedLimit: number;
    shouldStop: boolean;
    state: RouteFollowerState;
  } {
    if (this.completed || this.route.waypoints.length === 0) {
      const lastWp = this.route.waypoints[this.route.waypoints.length - 1];
      return {
        targetPosition: lastWp?.position ?? currentPosition,
        targetHeading: lastWp?.heading ?? 0,
        speedLimit: 0,
        shouldStop: true,
        state: this.getState(currentPosition),
      };
    }

    const currentWaypoint = this.route.waypoints[this.currentIndex]!;

    // Handle waiting
    if (this.waitTimeRemaining > 0) {
      this.waitTimeRemaining -= dt;
      return {
        targetPosition: currentWaypoint.position,
        targetHeading: currentWaypoint.heading,
        speedLimit: 0,
        shouldStop: true,
        state: this.getState(currentPosition),
      };
    }

    // Check if reached current waypoint
    const distanceToWaypoint = Vec3.distance(currentPosition, currentWaypoint.position);
    const reachThreshold = 1.0;

    if (distanceToWaypoint < reachThreshold) {
      this.traveledDistance += distanceToWaypoint;

      // Handle stop at waypoint
      if (currentWaypoint.stopRequired && currentWaypoint.waitTime) {
        this.waitTimeRemaining = currentWaypoint.waitTime;
      }

      // Move to next waypoint
      this.currentIndex++;
      if (this.currentIndex >= this.route.waypoints.length) {
        this.completed = true;
        return {
          targetPosition: currentWaypoint.position,
          targetHeading: currentWaypoint.heading,
          speedLimit: 0,
          shouldStop: true,
          state: this.getState(currentPosition),
        };
      }
    }

    const targetWaypoint = this.route.waypoints[this.currentIndex]!;
    const nextWaypoint = this.route.waypoints[this.currentIndex + 1];

    // Calculate target heading
    let targetHeading = targetWaypoint.heading;
    if (nextWaypoint) {
      const direction = Vec3.normalize(
        Vec3.sub(nextWaypoint.position, targetWaypoint.position)
      );
      targetHeading = Math.atan2(direction.x, direction.z);
    }

    return {
      targetPosition: targetWaypoint.position,
      targetHeading,
      speedLimit: targetWaypoint.speedLimit ?? 15,
      shouldStop: targetWaypoint.stopRequired ?? false,
      state: this.getState(currentPosition),
    };
  }

  getState(currentPosition: Vector3): RouteFollowerState {
    const currentWaypoint = this.route.waypoints[this.currentIndex];
    const distanceToNext = currentWaypoint
      ? Vec3.distance(currentPosition, currentWaypoint.position)
      : 0;

    return {
      currentWaypointIndex: this.currentIndex,
      distanceToNextWaypoint: distanceToNext,
      isWaiting: this.waitTimeRemaining > 0,
      waitTimeRemaining: this.waitTimeRemaining,
      completed: this.completed,
      progress: this.route.totalDistance > 0
        ? this.traveledDistance / this.route.totalDistance
        : 1,
    };
  }

  reset(): void {
    this.currentIndex = 0;
    this.waitTimeRemaining = 0;
    this.completed = false;
    this.traveledDistance = 0;
  }

  isCompleted(): boolean {
    return this.completed;
  }

  getRoute(): Route {
    return this.route;
  }
}

// =============================================================================
// Lane Following
// =============================================================================

export interface LanePosition {
  lane: Lane;
  progress: number;
  lateralOffset: number;
  position: Vector3;
}

export function getLanePosition(lane: Lane, progress: number, lateralOffset = 0): Vector3 {
  const position = Vec3.lerp(lane.startPosition, lane.endPosition, progress);

  if (lateralOffset !== 0) {
    const direction = Vec3.normalize(Vec3.sub(lane.endPosition, lane.startPosition));
    const lateral = Vec3.cross(Vec3.up(), direction);
    return Vec3.add(position, Vec3.mul(lateral, lateralOffset));
  }

  return position;
}

export function projectToLane(position: Vector3, lane: Lane): LanePosition {
  const ab = Vec3.sub(lane.endPosition, lane.startPosition);
  const ap = Vec3.sub(position, lane.startPosition);
  const abLenSq = Vec3.lengthSq(ab);

  let progress = 0;
  if (abLenSq > 0) {
    progress = Math.max(0, Math.min(1, Vec3.dot(ap, ab) / abLenSq));
  }

  const projectedPosition = Vec3.lerp(lane.startPosition, lane.endPosition, progress);
  const offset = Vec3.sub(position, projectedPosition);
  const direction = Vec3.normalize(ab);
  const lateral = Vec3.cross(Vec3.up(), direction);
  const lateralOffset = Vec3.dot(offset, lateral);

  return {
    lane,
    progress,
    lateralOffset,
    position: projectedPosition,
  };
}

export function isInLane(position: Vector3, lane: Lane, tolerance = 0): boolean {
  const lanePos = projectToLane(position, lane);
  const effectiveWidth = lane.width / 2 + tolerance;
  return Math.abs(lanePos.lateralOffset) <= effectiveWidth;
}

// =============================================================================
// Route Utilities
// =============================================================================

export function smoothRoute(route: Route, smoothingFactor = 0.5): Route {
  if (route.waypoints.length <= 2) return route;

  const smoothedWaypoints: RouteWaypoint[] = [route.waypoints[0]!];

  for (let i = 1; i < route.waypoints.length - 1; i++) {
    const prev = route.waypoints[i - 1]!;
    const curr = route.waypoints[i]!;
    const next = route.waypoints[i + 1]!;

    const smoothedPosition = Vec3.lerp(
      curr.position,
      Vec3.mul(Vec3.add(Vec3.add(prev.position, curr.position), next.position), 1/3),
      smoothingFactor
    );

    smoothedWaypoints.push({
      ...curr,
      position: smoothedPosition,
    });
  }

  smoothedWaypoints.push(route.waypoints[route.waypoints.length - 1]!);

  const builder = new RouteBuilder(route.id);
  for (const wp of smoothedWaypoints) {
    builder.addWaypoint(wp.position, {
      heading: wp.heading,
      speedLimit: wp.speedLimit,
      stopRequired: wp.stopRequired,
      waitTime: wp.waitTime,
      laneId: wp.laneId,
    });
  }

  return builder.build();
}

export function interpolateRoute(route: Route, maxSegmentLength: number): Route {
  if (route.waypoints.length < 2 || maxSegmentLength <= 0) return route;

  const builder = new RouteBuilder(route.id);
  builder.addWaypoint(route.waypoints[0]!.position, route.waypoints[0]);

  for (let i = 1; i < route.waypoints.length; i++) {
    const prev = route.waypoints[i - 1]!;
    const curr = route.waypoints[i]!;
    const distance = Vec3.distance(prev.position, curr.position);
    const segments = Math.max(1, Math.ceil(distance / maxSegmentLength));

    for (let s = 1; s <= segments; s++) {
      const t = s / segments;
      const position = Vec3.lerp(prev.position, curr.position, t);
      const heading = prev.heading + (curr.heading - prev.heading) * t;

      if (s === segments) {
        builder.addWaypoint(position, { ...curr, heading });
      } else {
        builder.addWaypoint(position, {
          heading,
          speedLimit: prev.speedLimit,
          laneId: prev.laneId,
        });
      }
    }
  }

  return builder.build();
}

export function calculateRouteLength(route: Route): number {
  let length = 0;
  for (let i = 1; i < route.waypoints.length; i++) {
    length += Vec3.distance(
      route.waypoints[i - 1]!.position,
      route.waypoints[i]!.position
    );
  }
  return length;
}

export function getRoutePositionAt(route: Route, progress: number): Vector3 {
  if (route.waypoints.length === 0) return Vec3.zero();
  if (route.waypoints.length === 1) return route.waypoints[0]!.position;
  if (progress <= 0) return route.waypoints[0]!.position;
  if (progress >= 1) return route.waypoints[route.waypoints.length - 1]!.position;

  const totalLength = calculateRouteLength(route);
  const targetDistance = totalLength * progress;

  let accumulated = 0;
  for (let i = 1; i < route.waypoints.length; i++) {
    const segmentLength = Vec3.distance(
      route.waypoints[i - 1]!.position,
      route.waypoints[i]!.position
    );

    if (accumulated + segmentLength >= targetDistance) {
      const segmentProgress = (targetDistance - accumulated) / segmentLength;
      return Vec3.lerp(
        route.waypoints[i - 1]!.position,
        route.waypoints[i]!.position,
        segmentProgress
      );
    }

    accumulated += segmentLength;
  }

  return route.waypoints[route.waypoints.length - 1]!.position;
}
