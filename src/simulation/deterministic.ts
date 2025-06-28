/**
 * VECTRIX SDK Deterministic Runtime
 * @module @vectrix/sdk/simulation
 */

import type { Vector3, SeedStream, IRandom } from '../core/types';

// =============================================================================
// Seeded Random Number Generator (Mulberry32)
// =============================================================================

export class SeededRandom implements IRandom {
  private state: number;
  private readonly initialSeed: number;
  private readonly subsystem: string;

  constructor(seed: number, subsystem = 'main') {
    this.initialSeed = seed;
    this.state = seed;
    this.subsystem = subsystem;
  }

  seed(value: number): void {
    this.state = value;
  }

  /**
   * Get next random number [0, 1)
   * Uses Mulberry32 algorithm for speed and quality
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  nextVector3(min: Vector3, max: Vector3): Vector3 {
    return {
      x: this.nextFloat(min.x, max.x),
      y: this.nextFloat(min.y, max.y),
      z: this.nextFloat(min.z, max.z),
    };
  }

  nextGaussian(mean = 0, stddev = 1): number {
    // Box-Muller transform
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stddev + mean;
  }

  nextBool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = result[i]!;
      result[i] = result[j]!;
      result[j] = temp;
    }
    return result;
  }

  pick<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[this.nextInt(0, array.length - 1)];
  }

  fork(subsystem: string): SeededRandom {
    // Generate a derived seed based on subsystem name
    const derivedSeed = this.hashString(`${this.initialSeed}:${this.subsystem}:${subsystem}`);
    return new SeededRandom(derivedSeed, subsystem);
  }

  getState(): number {
    return this.state;
  }

  reset(): void {
    this.state = this.initialSeed;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash | 0;
    }
    return Math.abs(hash);
  }
}

// =============================================================================
// Seed Stream Manager
// =============================================================================

export class SeedStreamManager {
  private readonly streams: Map<string, SeededRandom> = new Map();
  private readonly masterSeed: number;

  constructor(masterSeed?: number) {
    this.masterSeed = masterSeed ?? Date.now();
  }

  /**
   * Get or create a random stream for a subsystem
   */
  getStream(subsystem: keyof SeedStream | string): SeededRandom {
    let stream = this.streams.get(subsystem);
    if (!stream) {
      const seed = this.deriveSeed(subsystem);
      stream = new SeededRandom(seed, subsystem);
      this.streams.set(subsystem, stream);
    }
    return stream;
  }

  /**
   * Get the seed stream data for repro pack
   */
  getSeedStream(): SeedStream {
    return {
      master: this.masterSeed,
      physics: this.deriveSeed('physics'),
      collision: this.deriveSeed('collision'),
      pathfinding: this.deriveSeed('pathfinding'),
      sensors: this.deriveSeed('sensors'),
      randomization: this.deriveSeed('randomization'),
    };
  }

  /**
   * Restore from a seed stream
   */
  restoreFromStream(stream: SeedStream): void {
    this.streams.clear();
    this.streams.set('physics', new SeededRandom(stream.physics, 'physics'));
    this.streams.set('collision', new SeededRandom(stream.collision, 'collision'));
    this.streams.set('pathfinding', new SeededRandom(stream.pathfinding, 'pathfinding'));
    this.streams.set('sensors', new SeededRandom(stream.sensors, 'sensors'));
    this.streams.set('randomization', new SeededRandom(stream.randomization, 'randomization'));
  }

  /**
   * Reset all streams
   */
  reset(): void {
    for (const stream of this.streams.values()) {
      stream.reset();
    }
  }

  private deriveSeed(subsystem: string): number {
    // Derive deterministic seed from master seed and subsystem name
    let hash = this.masterSeed;
    for (let i = 0; i < subsystem.length; i++) {
      const char = subsystem.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash | 0;
    }
    return Math.abs(hash);
  }
}

// =============================================================================
// Deterministic Runtime
// =============================================================================

export interface DeterministicConfig {
  fixedTimestep: number;
  maxSubsteps: number;
  deterministicOrder: boolean;
  validateDeterminism: boolean;
  seed?: number;
}

export class DeterministicRuntime {
  private readonly config: DeterministicConfig;
  private readonly seedManager: SeedStreamManager;
  private accumulator = 0;
  private currentStep = 0;
  private stepHashes: number[] = [];

  constructor(config: Partial<DeterministicConfig> = {}) {
    this.config = {
      fixedTimestep: config.fixedTimestep ?? 0.016, // ~60 FPS
      maxSubsteps: config.maxSubsteps ?? 10,
      deterministicOrder: config.deterministicOrder ?? true,
      validateDeterminism: config.validateDeterminism ?? false,
      seed: config.seed,
    };

    this.seedManager = new SeedStreamManager(this.config.seed);
  }

  /**
   * Get fixed timestep
   */
  getTimestep(): number {
    return this.config.fixedTimestep;
  }

  /**
   * Get current step number
   */
  getCurrentStep(): number {
    return this.currentStep;
  }

  /**
   * Get random stream for subsystem
   */
  getRandom(subsystem: string): SeededRandom {
    return this.seedManager.getStream(subsystem);
  }

  /**
   * Advance simulation by delta time
   * Returns number of fixed steps taken
   */
  advance(deltaTime: number, stepCallback: (dt: number, step: number) => void): number {
    this.accumulator += deltaTime;

    let stepsTaken = 0;
    const maxTime = this.config.fixedTimestep * this.config.maxSubsteps;

    // Clamp accumulator to prevent spiral of death
    if (this.accumulator > maxTime) {
      this.accumulator = maxTime;
    }

    while (this.accumulator >= this.config.fixedTimestep) {
      stepCallback(this.config.fixedTimestep, this.currentStep);
      this.accumulator -= this.config.fixedTimestep;
      this.currentStep++;
      stepsTaken++;
    }

    return stepsTaken;
  }

  /**
   * Record step hash for determinism validation
   */
  recordStepHash(hash: number): void {
    if (this.config.validateDeterminism) {
      this.stepHashes.push(hash);
    }
  }

  /**
   * Get all recorded hashes
   */
  getStepHashes(): readonly number[] {
    return this.stepHashes;
  }

  /**
   * Compute final deterministic hash
   */
  computeFinalHash(): string {
    let hash = 0;
    for (const h of this.stepHashes) {
      hash = ((hash << 5) - hash) + h;
      hash = hash | 0;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  /**
   * Get seed stream for repro pack
   */
  getSeedStream(): SeedStream {
    return this.seedManager.getSeedStream();
  }

  /**
   * Reset runtime state
   */
  reset(): void {
    this.accumulator = 0;
    this.currentStep = 0;
    this.stepHashes = [];
    this.seedManager.reset();
  }
}

// =============================================================================
// Operation Ordering
// =============================================================================

/**
 * Ensure deterministic iteration order for maps
 */
export function deterministicMapIterate<K extends string | number, V>(
  map: Map<K, V>,
  callback: (key: K, value: V) => void
): void {
  const keys = Array.from(map.keys()).sort();
  for (const key of keys) {
    const value = map.get(key);
    if (value !== undefined) {
      callback(key, value);
    }
  }
}

/**
 * Sort entities by ID for deterministic processing
 */
export function sortByEntityId<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

// =============================================================================
// Hash Utilities
// =============================================================================

export function hashNumber(value: number): number {
  // Convert float to 32-bit integer representation
  const buffer = new ArrayBuffer(8);
  const view = new Float64Array(buffer);
  view[0] = value;
  const intView = new Int32Array(buffer);
  return (intView[0] ?? 0) ^ (intView[1] ?? 0);
}

export function hashVector3(v: { x: number; y: number; z: number }): number {
  const hx = hashNumber(v.x);
  const hy = hashNumber(v.y);
  const hz = hashNumber(v.z);
  return ((hx * 31) ^ (hy * 17) ^ hz) | 0;
}

export function combineHashes(...hashes: number[]): number {
  let result = 0;
  for (const h of hashes) {
    result = ((result << 5) - result + h) | 0;
  }
  return result;
}

