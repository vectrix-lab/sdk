/**
 * VECTRIX SDK Core Types
 * @module @vectrix/sdk/core
 */

// =============================================================================
// Vector & Math Types
// =============================================================================

export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Transform {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
}

export interface AABB {
  min: Vector3;
  max: Vector3;
}

export interface Bounds {
  center: Vector3;
  extents: Vector3;
}

// =============================================================================
// Entity Types
// =============================================================================

export type EntityId = string & { readonly __brand: 'EntityId' };
export type WorldId = string & { readonly __brand: 'WorldId' };
export type SimulationId = string & { readonly __brand: 'SimulationId' };

export interface EntityDescriptor {
  id: EntityId;
  type: EntityType;
  transform: Transform;
  properties: EntityProperties;
  metadata?: Record<string, unknown>;
}

export type EntityType =
  | 'drone'
  | 'robot'
  | 'vehicle'
  | 'pedestrian'
  | 'obstacle'
  | 'waypoint'
  | 'zone'
  | 'sensor'
  | 'custom';

export interface EntityProperties {
  mass?: number;
  friction?: number;
  restitution?: number;
  collisionRadius?: number;
  maxVelocity?: number;
  maxAcceleration?: number;
  controlMode?: ControlMode;
  customData?: Record<string, unknown>;
}

export type ControlMode = 'velocity' | 'position' | 'torque' | 'trajectory';

// =============================================================================
// State Types
// =============================================================================

export interface StateSnapshot {
  readonly version: number;
  readonly timestamp: number;
  readonly step: number;
  readonly entities: ReadonlyMap<EntityId, EntityState>;
  readonly worldState: WorldState;
  readonly hash: string;
}

export interface EntityState {
  id: EntityId;
  transform: Transform;
  velocity: Vector3;
  angularVelocity: Vector3;
  acceleration: Vector3;
  status: EntityStatus;
  customState?: Record<string, unknown>;
}

export type EntityStatus = 'active' | 'idle' | 'moving' | 'collision' | 'disabled';

export interface WorldState {
  time: number;
  gravity: Vector3;
  bounds: AABB;
  activeEntityCount: number;
  totalCollisions: number;
}

// =============================================================================
// Action & Control Types
// =============================================================================

export interface Action {
  entityId: EntityId;
  type: ActionType;
  parameters: ActionParameters;
  timestamp: number;
}

export type ActionType =
  | 'move_to'
  | 'set_velocity'
  | 'set_acceleration'
  | 'apply_force'
  | 'apply_torque'
  | 'follow_path'
  | 'stop'
  | 'custom';

export interface ActionParameters {
  target?: Vector3;
  velocity?: Vector3;
  force?: Vector3;
  torque?: Vector3;
  path?: Vector3[];
  duration?: number;
  priority?: number;
  customParams?: Record<string, unknown>;
}

export interface Control {
  entityId: EntityId;
  mode: ControlMode;
  setpoint: Vector3 | number[];
  constraints?: ControlConstraints;
}

export interface ControlConstraints {
  maxVelocity?: number;
  maxAcceleration?: number;
  maxForce?: number;
  maxTorque?: number;
  positionLimits?: { min: Vector3; max: Vector3 };
}

// =============================================================================
// Observation Types
// =============================================================================

export interface Observation {
  entityId: EntityId;
  timestamp: number;
  sensors: SensorReading[];
  localState: EntityState;
  nearbyEntities: NearbyEntity[];
}

export interface SensorReading {
  sensorId: string;
  type: SensorType;
  data: SensorData;
  noise?: number;
  latency?: number;
}

export type SensorType = 'lidar' | 'radar' | 'camera' | 'imu' | 'encoder' | 'gps' | 'proximity';

export type SensorData =
  | LidarData
  | RadarData
  | CameraData
  | IMUData
  | EncoderData
  | GPSData
  | ProximityData;

export interface LidarData {
  points: Vector3[];
  intensities?: number[];
  ranges: number[];
  angles: number[];
}

export interface RadarData {
  detections: RadarDetection[];
}

export interface RadarDetection {
  range: number;
  azimuth: number;
  elevation: number;
  velocity: number;
  rcs: number;
}

export interface CameraData {
  width: number;
  height: number;
  // todo: Add image data encoding support
  detections?: BoundingBox[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
}

export interface IMUData {
  acceleration: Vector3;
  angularVelocity: Vector3;
  orientation: Quaternion;
}

export interface EncoderData {
  position: number;
  velocity: number;
  ticks: number;
}

export interface GPSData {
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
}

export interface ProximityData {
  distance: number;
  detected: boolean;
}

export interface NearbyEntity {
  id: EntityId;
  distance: number;
  relativePosition: Vector3;
  relativeVelocity: Vector3;
}

// =============================================================================
// Simulation Configuration
// =============================================================================

export interface SimulationConfig {
  maxSteps: number;
  timestep: number;
  integrator?: IntegratorType;
  collisionBackend?: CollisionBackendType;
  seed?: number;
  strictMode?: boolean;
  enableProfiling?: boolean;
  snapshotInterval?: number;
}

export type IntegratorType = 'euler' | 'semi-implicit-euler' | 'rk4' | 'verlet';
export type CollisionBackendType = 'simple' | 'spatial-hash' | 'bvh' | 'octree';

// =============================================================================
// Results & Metrics
// =============================================================================

export interface SimulationResult {
  simulationId: SimulationId;
  status: SimulationStatus;
  trajectories: Trajectory[];
  collisionEvents: CollisionEvent[];
  metrics: SimulationMetrics;
  finalState: StateSnapshot;
  logs: LogEntry[];
  reproPack?: ReproPackData;
}

export type SimulationStatus = 'completed' | 'timeout' | 'error' | 'diverged' | 'cancelled';

export interface Trajectory {
  entityId: EntityId;
  waypoints: TrajectoryWaypoint[];
  totalDistance: number;
  totalTime: number;
  smoothness: number;
}

export interface TrajectoryWaypoint {
  position: Vector3;
  velocity: Vector3;
  timestamp: number;
  step: number;
}

export interface CollisionEvent {
  timestamp: number;
  step: number;
  entityA: EntityId;
  entityB: EntityId;
  contactPoint: Vector3;
  contactNormal: Vector3;
  penetrationDepth: number;
  impulse: number;
  type: CollisionType;
}

export type CollisionType = 'contact' | 'penetration' | 'trigger' | 'separation';

export interface SimulationMetrics {
  executionTimeMs: number;
  totalSteps: number;
  averageStepTimeMs: number;
  peakMemoryMb: number;
  entityCount: number;
  collisionChecks: number;
  pathfindingCalls: number;
  deterministicHash: string;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// =============================================================================
// Repro Pack (Reproducibility)
// =============================================================================

export interface ReproPackData {
  version: string;
  createdAt: string;
  scenarioConfig: Record<string, unknown>;
  simulationConfig: SimulationConfig;
  initialState: StateSnapshot;
  seeds: SeedStream;
  parameters: Record<string, unknown>;
  checksum: string;
}

export interface SeedStream {
  master: number;
  physics: number;
  collision: number;
  pathfinding: number;
  sensors: number;
  randomization: number;
}

// =============================================================================
// Client Configuration
// =============================================================================

export interface VectrixClientConfig {
  apiToken: string;
  apiUrl?: string;
  timeout?: number;
  retries?: number;
  strictMode?: boolean;
  logger?: ILogger;
}

// =============================================================================
// Interfaces (Contracts)
// =============================================================================

export interface ISimulator {
  initialize(config: SimulationConfig): Promise<void>;
  step(actions: Action[]): Promise<StateSnapshot>;
  getState(): StateSnapshot;
  reset(): Promise<void>;
  dispose(): void;
}

export interface IPhysicsBackend {
  setGravity(gravity: Vector3): void;
  addEntity(descriptor: EntityDescriptor): void;
  removeEntity(id: EntityId): void;
  applyForce(id: EntityId, force: Vector3): void;
  applyTorque(id: EntityId, torque: Vector3): void;
  integrate(dt: number): void;
  getEntityState(id: EntityId): EntityState | undefined;
}

export interface ICollisionBackend {
  addCollider(id: EntityId, bounds: AABB | number): void;
  removeCollider(id: EntityId): void;
  updateCollider(id: EntityId, transform: Transform): void;
  queryCollisions(): CollisionEvent[];
  queryNearby(position: Vector3, radius: number): EntityId[];
  raycast(origin: Vector3, direction: Vector3, maxDistance: number): RaycastHit | null;
}

export interface RaycastHit {
  entityId: EntityId;
  point: Vector3;
  normal: Vector3;
  distance: number;
}

export interface IPlanner {
  plan(start: Vector3, goal: Vector3, obstacles: AABB[]): Vector3[] | null;
  planMulti(requests: PlanRequest[]): PlanResult[];
  setConfig(config: PlannerConfig): void;
}

export interface PlanRequest {
  entityId: EntityId;
  start: Vector3;
  goal: Vector3;
  priority?: number;
  constraints?: PathConstraints;
}

export interface PlanResult {
  entityId: EntityId;
  success: boolean;
  path: Vector3[] | null;
  cost: number;
  planningTimeMs: number;
}

export interface PathConstraints {
  maxPathLength?: number;
  minClearance?: number;
  avoidEntities?: EntityId[];
  preferredAreas?: AABB[];
}

export interface PlannerConfig {
  algorithm: PlannerAlgorithm;
  maxIterations?: number;
  goalTolerance?: number;
  stepSize?: number;
  // todo: Add more planner-specific options
}

export type PlannerAlgorithm = 'astar' | 'dijkstra' | 'rrt' | 'rrt-star' | 'prm' | 'fmt';

export interface ILogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export interface IRandom {
  seed(value: number): void;
  next(): number;
  nextInt(min: number, max: number): number;
  nextFloat(min: number, max: number): number;
  nextVector3(min: Vector3, max: Vector3): Vector3;
  fork(subsystem: string): IRandom;
}

// =============================================================================
// Scenario Types
// =============================================================================

export interface ScenarioBase {
  readonly type: ScenarioType;
  readonly config: Record<string, unknown>;
  build(): ScenarioBuildResult;
  validate(): ValidationResult;
}

export type ScenarioType = 'drone-swarm' | 'warehouse' | 'av-edge-case' | 'custom';

export interface ScenarioBuildResult {
  entities: EntityDescriptor[];
  worldConfig: WorldConfig;
  initialActions: Action[];
  metadata: Record<string, unknown>;
}

export interface WorldConfig {
  size: Vector3;
  gravity: Vector3;
  bounds: AABB;
  gridResolution?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrorInfo[];
  warnings: ValidationWarning[];
}

export interface ValidationErrorInfo {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

// =============================================================================
// Executor Types
// =============================================================================

export interface ExecutorConfig {
  workerCount?: number;
  transportLayer?: TransportLayer;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export type TransportLayer = 'ipc' | 'tcp' | 'grpc' | 'memory';

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
}

export interface BatchResult<T> {
  results: T[];
  failures: BatchFailure[];
  totalTimeMs: number;
  successRate: number;
}

export interface BatchFailure {
  index: number;
  error: Error;
  retriesAttempted: number;
}

// =============================================================================
// Event Types
// =============================================================================

export type SimulationEvent =
  | { type: 'step'; step: number; timestamp: number }
  | { type: 'collision'; event: CollisionEvent }
  | { type: 'entity_added'; entity: EntityDescriptor }
  | { type: 'entity_removed'; entityId: EntityId }
  | { type: 'path_computed'; entityId: EntityId; path: Vector3[] }
  | { type: 'goal_reached'; entityId: EntityId }
  | { type: 'divergence'; message: string }
  | { type: 'warning'; message: string };

export type EventHandler = (event: SimulationEvent) => void;

// =============================================================================
// Version & Compatibility
// =============================================================================

export interface VersionInfo {
  sdk: string;
  api: string;
  protocol: number;
  capabilities: Capability[];
}

export type Capability =
  | 'distributed'
  | 'gpu-acceleration'
  | 'deterministic'
  | 'edge-case-gen'
  | 'replay'
  | 'streaming';

