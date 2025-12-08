/**
 * VECTRIX SDK Client
 * @module @vectrix/sdk/core
 */

import { AuthManager, getTokenFromEnv } from './auth';
import {
  TokenMissingError,
  ValidationError,
  TimeoutError,
  FeatureNotAvailableError,
} from './errors';
import type {
  VectrixClientConfig,
  SimulationConfig,
  SimulationResult,
  ScenarioBase,
  ILogger,
  VersionInfo,
  Capability,
  StateSnapshot,
  ReproPackData,
  SimulationId,
  EventHandler,
  SimulationEvent,
  CollisionEvent,
  EntityId,
} from './types';

// =============================================================================
// Constants
// =============================================================================

const SDK_VERSION = '2.4.1';
const API_VERSION = 'v2';
const PROTOCOL_VERSION = 3;
const DEFAULT_API_URL = 'https://api.vectrix.dev';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRIES = 3;

// =============================================================================
// Default Logger
// =============================================================================

const createDefaultLogger = (): ILogger => {
  const logLevel = process.env['VECTRIX_LOG_LEVEL'] || 'info';
  const levels: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
  const currentLevel = levels[logLevel] ?? 1;

  const log = (level: string, message: string, data?: Record<string, unknown>) => {
    if ((levels[level] ?? 0) >= currentLevel) {
      const prefix = `[VECTRIX:${level.toUpperCase()}]`;
      if (data) {
        console.log(prefix, message, data);
      } else {
        console.log(prefix, message);
      }
    }
  };

  return {
    debug: (msg, data) => log('debug', msg, data),
    info: (msg, data) => log('info', msg, data),
    warn: (msg, data) => log('warn', msg, data),
    error: (msg, data) => log('error', msg, data),
  };
};

// =============================================================================
// VectrixClient Class
// =============================================================================

export class VectrixClient {
  private readonly config: Required<Omit<VectrixClientConfig, 'logger'>> & { logger: ILogger };
  private readonly auth: AuthManager;
  private initialized = false;
  private eventHandlers: Set<EventHandler> = new Set();

  constructor(config: VectrixClientConfig) {
    // Resolve token from config or environment
    const token = config.apiToken || getTokenFromEnv();

    if (!token) {
      throw new TokenMissingError();
    }

    const logger = config.logger || createDefaultLogger();

    this.config = {
      apiToken: token,
      apiUrl: config.apiUrl || DEFAULT_API_URL,
      timeout: config.timeout || DEFAULT_TIMEOUT,
      retries: config.retries || DEFAULT_RETRIES,
      strictMode: config.strictMode ?? (process.env['VECTRIX_STRICT_MODE'] === 'true'),
      logger,
    };

    this.auth = new AuthManager(logger);
    this.auth.setToken(token);

    logger.debug('VectrixClient created', {
      apiUrl: this.config.apiUrl,
      timeout: this.config.timeout,
      strictMode: this.config.strictMode,
    });
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize the client and validate credentials
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.config.logger.info('Initializing VECTRIX SDK...');

    // Validate token with API
    await this.auth.validateToken();

    // Verify API connectivity
    await this.verifyApiConnectivity();

    this.initialized = true;
    this.config.logger.info('VECTRIX SDK initialized successfully', {
      version: SDK_VERSION,
      api: API_VERSION,
    });
  }

  /**
   * Ensure client is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Verify API connectivity
   */
  private async verifyApiConnectivity(): Promise<void> {
    // Simulate API health check
    await this.simulateApiCall('health', 50);
    this.config.logger.debug('API connectivity verified');
  }

  // ===========================================================================
  // Simulation Methods
  // ===========================================================================

  /**
   * Run a simulation with the given scenario
   */
  async simulate(
    scenario: ScenarioBase,
    config?: Partial<SimulationConfig>
  ): Promise<SimulationResult> {
    await this.ensureInitialized();

    const simulationConfig = this.resolveSimulationConfig(config);
    this.validateSimulationConfig(simulationConfig);

    // Validate scenario
    const validation = scenario.validate();
    if (!validation.valid) {
      throw new ValidationError(
        validation.errors.map(e => ({ field: e.field || '', message: e.message }))
      );
    }

    // Check quotas
    const quotas = this.auth.getQuotas();
    if (simulationConfig.maxSteps > quotas.maxStepsPerSimulation) {
      throw new FeatureNotAvailableError(
        `maxSteps > ${quotas.maxStepsPerSimulation}`,
        'professional'
      );
    }

    this.config.logger.info('Starting simulation', {
      scenario: scenario.type,
      maxSteps: simulationConfig.maxSteps,
      timestep: simulationConfig.timestep,
    });

    // Build scenario
    const buildResult = scenario.build();
    const entityCount = buildResult.entities.length;

    if (entityCount > quotas.maxEntitiesPerSimulation) {
      throw new FeatureNotAvailableError(
        `Entity count (${entityCount}) exceeds plan limit (${quotas.maxEntitiesPerSimulation})`,
        'enterprise'
      );
    }

    // Emit start event
    this.emitEvent({ type: 'step', step: 0, timestamp: Date.now() });

    // Simulate execution
    const startTime = Date.now();
    const result = await this.executeSimulation(scenario, simulationConfig, buildResult);
    const executionTime = Date.now() - startTime;

    this.config.logger.info('Simulation completed', {
      status: result.status,
      steps: result.metrics.totalSteps,
      executionTimeMs: executionTime,
    });

    return result;
  }

  /**
   * Execute simulation (mock implementation)
   */
  private async executeSimulation(
    scenario: ScenarioBase,
    config: SimulationConfig,
    buildResult: ReturnType<ScenarioBase['build']>
  ): Promise<SimulationResult> {
    // Simulate processing time based on complexity
    const complexity = buildResult.entities.length * config.maxSteps;
    const simulatedTime = Math.min(complexity / 10000, this.config.timeout / 2);
    await this.simulateApiCall('simulate', simulatedTime);

    const simulationId = this.generateId('sim') as SimulationId;
    const now = Date.now();

    // Generate mock trajectories
    const trajectories = buildResult.entities
      .filter(e => e.type !== 'obstacle' && e.type !== 'zone')
      .map(entity => ({
        entityId: entity.id,
        waypoints: this.generateMockWaypoints(entity.transform.position, config),
        totalDistance: Math.random() * 100 + 50,
        totalTime: config.maxSteps * config.timestep,
        smoothness: 0.85 + Math.random() * 0.1,
      }));

    // Generate mock collision events
    const collisionCount = Math.floor(Math.random() * buildResult.entities.length * 0.1);
    const collisionEvents: CollisionEvent[] = Array.from({ length: collisionCount }, (_, i) => ({
      timestamp: now + i * 1000,
      step: Math.floor(Math.random() * config.maxSteps),
      entityA: (buildResult.entities[0]?.id ?? this.generateId('ent')) as EntityId,
      entityB: (buildResult.entities[1]?.id ?? this.generateId('ent')) as EntityId,
      contactPoint: { x: Math.random() * 100, y: 0, z: Math.random() * 100 },
      contactNormal: { x: 0, y: 1, z: 0 },
      penetrationDepth: Math.random() * 0.5,
      impulse: Math.random() * 10,
      type: 'contact' as const,
    }));

    // Final state
    const finalState: StateSnapshot = {
      version: PROTOCOL_VERSION,
      timestamp: now,
      step: config.maxSteps,
      entities: new Map(),
      worldState: {
        time: config.maxSteps * config.timestep,
        gravity: buildResult.worldConfig.gravity,
        bounds: buildResult.worldConfig.bounds,
        activeEntityCount: buildResult.entities.length,
        totalCollisions: collisionCount,
      },
      hash: this.generateHash(`${simulationId}-${config.seed || 0}`),
    };

    return {
      simulationId,
      status: 'completed',
      trajectories,
      collisionEvents,
      metrics: {
        executionTimeMs: simulatedTime,
        totalSteps: config.maxSteps,
        averageStepTimeMs: simulatedTime / config.maxSteps,
        peakMemoryMb: buildResult.entities.length * 0.1 + 10,
        entityCount: buildResult.entities.length,
        collisionChecks: buildResult.entities.length * config.maxSteps * 2,
        pathfindingCalls: trajectories.length * Math.ceil(config.maxSteps / 100),
        deterministicHash: finalState.hash,
      },
      finalState,
      logs: [],
      reproPack: this.generateReproPack(scenario, config, finalState),
    };
  }

  /**
   * Replay a simulation from repro pack
   */
  async replay(reproPack: ReproPackData): Promise<SimulationResult> {
    await this.ensureInitialized();

    if (!this.auth.hasCapability('replay')) {
      throw new FeatureNotAvailableError('replay', 'professional');
    }

    this.config.logger.info('Replaying simulation from repro pack', {
      version: reproPack.version,
      createdAt: reproPack.createdAt,
    });

    // Simulate replay
    await this.simulateApiCall('replay', 200);

    // Return mock result matching original
    const simulationId = this.generateId('sim') as SimulationId;

    return {
      simulationId,
      status: 'completed',
      trajectories: [],
      collisionEvents: [],
      metrics: {
        executionTimeMs: 100,
        totalSteps: reproPack.simulationConfig.maxSteps,
        averageStepTimeMs: 0.1,
        peakMemoryMb: 50,
        entityCount: 0,
        collisionChecks: 0,
        pathfindingCalls: 0,
        deterministicHash: reproPack.checksum,
      },
      finalState: reproPack.initialState,
      logs: [],
    };
  }

  // ===========================================================================
  // Event System
  // ===========================================================================

  /**
   * Subscribe to simulation events
   */
  on(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Emit event to all handlers
   */
  private emitEvent(event: SimulationEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        this.config.logger.error('Event handler error', {
          event: event.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // ===========================================================================
  // Info & Status
  // ===========================================================================

  /**
   * Get SDK and API version info
   */
  getVersionInfo(): VersionInfo {
    const capabilities = this.initialized
      ? this.auth.getPayload().capabilities
      : [];

    return {
      sdk: SDK_VERSION,
      api: API_VERSION,
      protocol: PROTOCOL_VERSION,
      capabilities,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<VectrixClientConfig> {
    return {
      apiToken: this.auth.getMaskedToken(),
      apiUrl: this.config.apiUrl,
      timeout: this.config.timeout,
      retries: this.config.retries,
      strictMode: this.config.strictMode,
    };
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if feature is available
   */
  hasCapability(capability: Capability): boolean {
    if (!this.initialized) return false;
    return this.auth.hasCapability(capability);
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Dispose client and cleanup resources
   */
  dispose(): void {
    this.eventHandlers.clear();
    this.auth.clear();
    this.initialized = false;
    this.config.logger.info('VectrixClient disposed');
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private resolveSimulationConfig(config?: Partial<SimulationConfig>): SimulationConfig {
    return {
      maxSteps: config?.maxSteps ?? 10000,
      timestep: config?.timestep ?? 0.016,
      integrator: config?.integrator ?? 'semi-implicit-euler',
      collisionBackend: config?.collisionBackend ?? 'spatial-hash',
      seed: config?.seed ?? Date.now(),
      strictMode: config?.strictMode ?? this.config.strictMode,
      enableProfiling: config?.enableProfiling ?? false,
      snapshotInterval: config?.snapshotInterval,
    };
  }

  private validateSimulationConfig(config: SimulationConfig): void {
    const errors: Array<{ field: string; message: string }> = [];

    if (config.maxSteps < 1) {
      errors.push({ field: 'maxSteps', message: 'Must be at least 1' });
    }
    if (config.maxSteps > 10000000) {
      errors.push({ field: 'maxSteps', message: 'Exceeds maximum allowed (10M)' });
    }
    if (config.timestep <= 0) {
      errors.push({ field: 'timestep', message: 'Must be positive' });
    }
    if (config.timestep > 1) {
      errors.push({ field: 'timestep', message: 'Timestep too large (max 1.0)' });
    }

    if (errors.length > 0) {
      throw new ValidationError(errors);
    }
  }

  private async simulateApiCall(_endpoint: string, baseTimeMs: number): Promise<void> {
    const jitter = Math.random() * 50;
    const delay = baseTimeMs + jitter;

    if (delay > this.config.timeout) {
      throw new TimeoutError(this.config.timeout, 0);
    }

    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private generateId(prefix: string): string {
    const random = Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now().toString(36);
    return `${prefix}_${timestamp}${random}`;
  }

  private generateHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  private generateMockWaypoints(
    start: { x: number; y: number; z: number },
    config: SimulationConfig
  ) {
    const count = Math.min(100, Math.floor(config.maxSteps / 100));
    const waypoints = [];

    for (let i = 0; i <= count; i++) {
      const t = i / count;
      waypoints.push({
        position: {
          x: start.x + Math.sin(t * Math.PI * 2) * 50,
          y: start.y,
          z: start.z + t * 100,
        },
        velocity: {
          x: Math.cos(t * Math.PI * 2) * 5,
          y: 0,
          z: 10,
        },
        timestamp: t * config.maxSteps * config.timestep,
        step: Math.floor(t * config.maxSteps),
      });
    }

    return waypoints;
  }

  private generateReproPack(
    scenario: ScenarioBase,
    config: SimulationConfig,
    finalState: StateSnapshot
  ): ReproPackData {
    return {
      version: SDK_VERSION,
      createdAt: new Date().toISOString(),
      scenarioConfig: scenario.config,
      simulationConfig: config,
      initialState: finalState,
      seeds: {
        master: config.seed || Date.now(),
        physics: (config.seed || Date.now()) + 1,
        collision: (config.seed || Date.now()) + 2,
        pathfinding: (config.seed || Date.now()) + 3,
        sensors: (config.seed || Date.now()) + 4,
        randomization: (config.seed || Date.now()) + 5,
      },
      parameters: {},
      checksum: finalState.hash,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a VectrixClient instance
 */
export function createClient(config: VectrixClientConfig): VectrixClient {
  return new VectrixClient(config);
}

/**
 * Create a VectrixClient from environment variables
 */
export function createClientFromEnv(): VectrixClient {
  const token = getTokenFromEnv();
  if (!token) {
    throw new TokenMissingError();
  }

  return new VectrixClient({
    apiToken: token,
    apiUrl: process.env['VECTRIX_API_URL'],
    timeout: process.env['VECTRIX_TIMEOUT']
      ? parseInt(process.env['VECTRIX_TIMEOUT'], 10)
      : undefined,
    strictMode: process.env['VECTRIX_STRICT_MODE'] === 'true',
  });
}

