/**
 * VECTRIX SDK Distributed Executor
 * @module @vectrix/sdk/executor
 */

import type {
  ScenarioBase,
  SimulationConfig,
  SimulationResult,
  BatchResult,
  BatchFailure,
  ExecutorConfig,
  TransportLayer,
  ILogger,
} from '../core/types';
import { ExecutorError, FeatureNotAvailableError } from '../core/errors';

// =============================================================================
// Types
// =============================================================================

export interface WorkerInfo {
  id: string;
  status: WorkerStatus;
  address?: string;
  capabilities: string[];
  currentTask?: string;
  completedTasks: number;
  failedTasks: number;
  lastHeartbeat: number;
}

export type WorkerStatus = 'idle' | 'busy' | 'offline' | 'error';

export interface DistributedExecutorConfig extends ExecutorConfig {
  workerCount: number;
  transportLayer: TransportLayer;
  heartbeatInterval?: number;
  workerTimeout?: number;
  loadBalancing?: LoadBalancingStrategy;
  logger?: ILogger;
}

export type LoadBalancingStrategy = 'round-robin' | 'least-busy' | 'random' | 'capability-match';

export interface ShardConfig {
  shardId: number;
  totalShards: number;
  scenarios: ScenarioBase[];
}

// =============================================================================
// Distributed Executor
// =============================================================================

export class DistributedExecutor {
  private readonly config: DistributedExecutorConfig;
  private readonly logger?: ILogger;
  private readonly workers: Map<string, WorkerInfo> = new Map();
  private initialized = false;
  private nextWorkerId = 0;
  private roundRobinIndex = 0;

  constructor(config: Partial<DistributedExecutorConfig> = {}) {
    this.config = {
      workerCount: config.workerCount ?? 4,
      transportLayer: config.transportLayer ?? 'ipc',
      heartbeatInterval: config.heartbeatInterval ?? 5000,
      workerTimeout: config.workerTimeout ?? 30000,
      loadBalancing: config.loadBalancing ?? 'round-robin',
      timeout: config.timeout ?? 60000,
      retryPolicy: config.retryPolicy ?? {
        maxRetries: 3,
        backoffMs: 1000,
        backoffMultiplier: 2,
      },
      logger: config.logger,
    };
    this.logger = config.logger;
  }

  /**
   * Initialize the distributed executor
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.logger?.info('Initializing distributed executor', {
      workerCount: this.config.workerCount,
      transport: this.config.transportLayer,
    });

    // Spawn mock workers
    for (let i = 0; i < this.config.workerCount; i++) {
      const workerId = this.generateWorkerId();
      this.workers.set(workerId, {
        id: workerId,
        status: 'idle',
        capabilities: ['simulation', 'pathfinding'],
        completedTasks: 0,
        failedTasks: 0,
        lastHeartbeat: Date.now(),
      });
    }

    this.initialized = true;
    this.logger?.info('Distributed executor initialized', {
      activeWorkers: this.workers.size,
    });
  }

  /**
   * Run a batch of simulations across workers
   */
  async runBatch(
    scenarios: ScenarioBase[],
    config: SimulationConfig,
    options?: { parallelism?: number; timeout?: number }
  ): Promise<BatchResult<SimulationResult>> {
    await this.ensureInitialized();

    const startTime = Date.now();
    const parallelism = options?.parallelism ?? this.config.workerCount;
    const timeout = options?.timeout ?? this.config.timeout;

    this.logger?.info('Starting distributed batch execution', {
      scenarioCount: scenarios.length,
      parallelism,
      timeout,
    });

    // Shard scenarios across workers
    const shards = this.shardScenarios(scenarios, parallelism);
    const results: SimulationResult[] = [];
    const failures: BatchFailure[] = [];

    // Process shards in parallel
    const shardPromises = shards.map(async (shard, shardIndex) => {
      const worker = this.selectWorker();
      if (!worker) {
        failures.push({
          index: shardIndex,
          error: new ExecutorError('No available workers'),
          retriesAttempted: 0,
        });
        return;
      }

      try {
        worker.status = 'busy';
        worker.currentTask = `shard-${shardIndex}`;

        // Simulate distributed execution
        for (let i = 0; i < shard.scenarios.length; i++) {
          const scenario = shard.scenarios[i]!;
          const result = await this.executeOnWorker(worker, scenario, config);
          results.push(result);
          worker.completedTasks++;
        }
      } catch (error) {
        worker.failedTasks++;
        failures.push({
          index: shardIndex,
          error: error instanceof Error ? error : new Error(String(error)),
          retriesAttempted: this.config.retryPolicy?.maxRetries ?? 0,
        });
      } finally {
        worker.status = 'idle';
        worker.currentTask = undefined;
        worker.lastHeartbeat = Date.now();
      }
    });

    await Promise.all(shardPromises);

    const totalTime = Date.now() - startTime;

    this.logger?.info('Distributed batch execution completed', {
      completed: results.length,
      failed: failures.length,
      totalTimeMs: totalTime,
    });

    return {
      results,
      failures,
      totalTimeMs: totalTime,
      successRate: scenarios.length > 0 ? results.length / scenarios.length : 1,
    };
  }

  /**
   * Execute a single simulation on a worker
   */
  private async executeOnWorker(
    _worker: WorkerInfo,
    scenario: ScenarioBase,
    config: SimulationConfig
  ): Promise<SimulationResult> {
    // Simulate network latency and execution time
    const latency = 10 + Math.random() * 40;
    const executionTime = 50 + Math.random() * 150;
    await this.delay(latency + executionTime);

    // Build mock result
    const buildResult = scenario.build();

    return {
      simulationId: `sim_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` as any,
      status: 'completed',
      trajectories: buildResult.entities
        .filter(e => e.type !== 'obstacle')
        .map(e => ({
          entityId: e.id,
          waypoints: [],
          totalDistance: Math.random() * 100,
          totalTime: config.maxSteps * config.timestep,
          smoothness: 0.9,
        })),
      collisionEvents: [],
      metrics: {
        executionTimeMs: executionTime,
        totalSteps: config.maxSteps,
        averageStepTimeMs: executionTime / config.maxSteps,
        peakMemoryMb: 50 + Math.random() * 50,
        entityCount: buildResult.entities.length,
        collisionChecks: buildResult.entities.length * config.maxSteps,
        pathfindingCalls: Math.floor(config.maxSteps / 100),
        deterministicHash: Math.random().toString(16).slice(2, 18),
      },
      finalState: {
        version: 3,
        timestamp: Date.now(),
        step: config.maxSteps,
        entities: new Map(),
        worldState: {
          time: config.maxSteps * config.timestep,
          gravity: buildResult.worldConfig.gravity,
          bounds: buildResult.worldConfig.bounds,
          activeEntityCount: buildResult.entities.length,
          totalCollisions: 0,
        },
        hash: Math.random().toString(16).slice(2, 18),
      },
      logs: [],
    };
  }

  /**
   * Get worker status
   */
  getWorkers(): WorkerInfo[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get executor statistics
   */
  getStats(): {
    totalWorkers: number;
    activeWorkers: number;
    idleWorkers: number;
    totalCompleted: number;
    totalFailed: number;
  } {
    const workers = this.getWorkers();
    return {
      totalWorkers: workers.length,
      activeWorkers: workers.filter(w => w.status === 'busy').length,
      idleWorkers: workers.filter(w => w.status === 'idle').length,
      totalCompleted: workers.reduce((sum, w) => sum + w.completedTasks, 0),
      totalFailed: workers.reduce((sum, w) => sum + w.failedTasks, 0),
    };
  }

  /**
   * Shutdown the executor
   */
  async shutdown(): Promise<void> {
    this.logger?.info('Shutting down distributed executor');
    this.workers.clear();
    this.initialized = false;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private generateWorkerId(): string {
    return `worker_${(this.nextWorkerId++).toString().padStart(3, '0')}`;
  }

  private selectWorker(): WorkerInfo | null {
    const availableWorkers = Array.from(this.workers.values())
      .filter(w => w.status === 'idle');

    if (availableWorkers.length === 0) return null;

    switch (this.config.loadBalancing) {
      case 'round-robin': {
        const worker = availableWorkers[this.roundRobinIndex % availableWorkers.length];
        this.roundRobinIndex++;
        return worker ?? null;
      }
      case 'least-busy': {
        return availableWorkers.reduce((min, w) =>
          w.completedTasks < (min?.completedTasks ?? Infinity) ? w : min,
          availableWorkers[0]
        ) ?? null;
      }
      case 'random': {
        const index = Math.floor(Math.random() * availableWorkers.length);
        return availableWorkers[index] ?? null;
      }
      default:
        return availableWorkers[0] ?? null;
    }
  }

  private shardScenarios(scenarios: ScenarioBase[], shardCount: number): ShardConfig[] {
    const shards: ShardConfig[] = [];
    const scenariosPerShard = Math.ceil(scenarios.length / shardCount);

    for (let i = 0; i < shardCount; i++) {
      const start = i * scenariosPerShard;
      const end = Math.min(start + scenariosPerShard, scenarios.length);

      if (start < scenarios.length) {
        shards.push({
          shardId: i,
          totalShards: shardCount,
          scenarios: scenarios.slice(start, end),
        });
      }
    }

    return shards;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Remote Worker Interface (for future implementation)
// =============================================================================

// todo: Implement actual remote worker communication
export interface IRemoteWorker {
  connect(address: string): Promise<void>;
  disconnect(): Promise<void>;
  execute(scenario: ScenarioBase, config: SimulationConfig): Promise<SimulationResult>;
  getStatus(): Promise<WorkerInfo>;
  ping(): Promise<number>;
}

// Placeholder for gRPC/IPC transport
export class RemoteWorkerStub implements IRemoteWorker {
  async connect(_address: string): Promise<void> {
    throw new FeatureNotAvailableError('Remote workers', 'enterprise');
  }

  async disconnect(): Promise<void> {
    throw new FeatureNotAvailableError('Remote workers', 'enterprise');
  }

  async execute(_scenario: ScenarioBase, _config: SimulationConfig): Promise<SimulationResult> {
    throw new FeatureNotAvailableError('Remote workers', 'enterprise');
  }

  async getStatus(): Promise<WorkerInfo> {
    throw new FeatureNotAvailableError('Remote workers', 'enterprise');
  }

  async ping(): Promise<number> {
    throw new FeatureNotAvailableError('Remote workers', 'enterprise');
  }
}

