/**
 * VECTRIX SDK Local Executor
 * @module @vectrix/sdk/executor
 */

import type {
  ScenarioBase,
  SimulationConfig,
  SimulationResult,
  BatchResult,
  BatchFailure,
  ILogger,
} from '../core/types';
import { TimeoutError, ExecutorError } from '../core/errors';

// =============================================================================
// Types
// =============================================================================

export interface LocalExecutorConfig {
  maxConcurrent?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  logger?: ILogger;
}

export interface ExecutionTask {
  id: string;
  scenario: ScenarioBase;
  config: SimulationConfig;
  priority?: number;
}

export interface ExecutionProgress {
  completed: number;
  total: number;
  failed: number;
  inProgress: number;
  estimatedTimeRemaining: number;
}

export type ProgressCallback = (progress: ExecutionProgress) => void;

// =============================================================================
// Local Executor
// =============================================================================

export class LocalExecutor {
  private readonly config: Required<LocalExecutorConfig>;
  private readonly logger?: ILogger;
  private runningTasks = 0;
  private completedTasks = 0;
  private failedTasks = 0;

  constructor(config: LocalExecutorConfig = {}) {
    const logger = config.logger ?? this.createDefaultLogger();
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 4,
      timeout: config.timeout ?? 30000,
      retryAttempts: config.retryAttempts ?? 2,
      retryDelay: config.retryDelay ?? 1000,
      logger,
    };
    this.logger = config.logger;
  }

  private createDefaultLogger(): ILogger {
    return {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
  }

  /**
   * Execute a single simulation
   */
  async execute(
    scenario: ScenarioBase,
    config: SimulationConfig,
    simulate: (scenario: ScenarioBase, config: SimulationConfig) => Promise<SimulationResult>
  ): Promise<SimulationResult> {
    const startTime = Date.now();

    try {
      this.logger?.debug('Starting local execution', {
        scenario: scenario.type,
        timeout: this.config.timeout,
      });

      // Add timeout wrapper
      const result = await this.withTimeout(
        simulate(scenario, config),
        this.config.timeout
      );

      this.logger?.debug('Execution completed', {
        executionTimeMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      this.logger?.error('Execution failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Execute multiple simulations in parallel
   */
  async executeBatch(
    tasks: ExecutionTask[],
    simulate: (scenario: ScenarioBase, config: SimulationConfig) => Promise<SimulationResult>,
    onProgress?: ProgressCallback
  ): Promise<BatchResult<SimulationResult>> {
    const startTime = Date.now();
    this.completedTasks = 0;
    this.failedTasks = 0;

    const results: SimulationResult[] = [];
    const failures: BatchFailure[] = [];

    // Sort by priority if specified
    const sortedTasks = [...tasks].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // Process in batches
    const batches = this.chunkArray(sortedTasks, this.config.maxConcurrent);

    for (const batch of batches) {
      const batchPromises = batch.map(async (task, _batchIndex) => {
        const taskIndex = sortedTasks.indexOf(task);

        try {
          this.runningTasks++;
          const result = await this.executeWithRetry(
            task.scenario,
            task.config,
            simulate,
            this.config.retryAttempts
          );
          results.push(result);
          this.completedTasks++;
        } catch (error) {
          this.failedTasks++;
          failures.push({
            index: taskIndex,
            error: error instanceof Error ? error : new Error(String(error)),
            retriesAttempted: this.config.retryAttempts,
          });
        } finally {
          this.runningTasks--;

          // Report progress
          if (onProgress) {
            const elapsed = Date.now() - startTime;
            const avgTime = elapsed / (this.completedTasks + this.failedTasks || 1);
            const remaining = tasks.length - this.completedTasks - this.failedTasks;

            onProgress({
              completed: this.completedTasks,
              total: tasks.length,
              failed: this.failedTasks,
              inProgress: this.runningTasks,
              estimatedTimeRemaining: avgTime * remaining,
            });
          }
        }
      });

      await Promise.all(batchPromises);
    }

    const totalTime = Date.now() - startTime;

    return {
      results,
      failures,
      totalTimeMs: totalTime,
      successRate: tasks.length > 0 ? results.length / tasks.length : 1,
    };
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(
    scenario: ScenarioBase,
    config: SimulationConfig,
    simulate: (scenario: ScenarioBase, config: SimulationConfig) => Promise<SimulationResult>,
    retriesLeft: number
  ): Promise<SimulationResult> {
    try {
      return await this.withTimeout(simulate(scenario, config), this.config.timeout);
    } catch (error) {
      if (retriesLeft > 0 && this.isRetryableError(error)) {
        this.logger?.warn('Retrying failed execution', {
          retriesLeft,
          error: error instanceof Error ? error.message : String(error),
        });

        await this.delay(this.config.retryDelay);
        return this.executeWithRetry(scenario, config, simulate, retriesLeft - 1);
      }
      throw error;
    }
  }

  /**
   * Get current executor status
   */
  getStatus(): {
    running: number;
    completed: number;
    failed: number;
    maxConcurrent: number;
  } {
    return {
      running: this.runningTasks,
      completed: this.completedTasks,
      failed: this.failedTasks,
      maxConcurrent: this.config.maxConcurrent,
    };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new TimeoutError(timeoutMs, 0));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof TimeoutError) return true;
    if (error instanceof ExecutorError) return true;
    return false;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Task Queue
// =============================================================================

export class TaskQueue {
  private queue: ExecutionTask[] = [];
  private processing = false;
  private readonly executor: LocalExecutor;

  constructor(executor: LocalExecutor) {
    this.executor = executor;
  }

  enqueue(task: ExecutionTask): void {
    this.queue.push(task);
    // Sort by priority
    this.queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  enqueueMany(tasks: ExecutionTask[]): void {
    for (const task of tasks) {
      this.enqueue(task);
    }
  }

  dequeue(): ExecutionTask | undefined {
    return this.queue.shift();
  }

  peek(): ExecutionTask | undefined {
    return this.queue[0];
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  clear(): void {
    this.queue = [];
  }

  async processAll(
    simulate: (scenario: ScenarioBase, config: SimulationConfig) => Promise<SimulationResult>,
    onProgress?: ProgressCallback
  ): Promise<BatchResult<SimulationResult>> {
    if (this.processing) {
      throw new ExecutorError('Queue is already being processed');
    }

    this.processing = true;
    try {
      const tasks = [...this.queue];
      this.queue = [];
      return await this.executor.executeBatch(tasks, simulate, onProgress);
    } finally {
      this.processing = false;
    }
  }
}

