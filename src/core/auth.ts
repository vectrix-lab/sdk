/**
 * VECTRIX SDK Authentication Module
 * @module @vectrix/sdk/core
 */

import {
  TokenMissingError,
  TokenInvalidError,
  TokenExpiredError,
  QuotaExceededError,
} from './errors';
import type { ILogger, Capability } from './types';

// =============================================================================
// Token Types
// =============================================================================

export interface TokenPayload {
  sub: string;           // Subject (user/org ID)
  iss: string;           // Issuer
  iat: number;           // Issued at (Unix timestamp)
  exp: number;           // Expiration (Unix timestamp)
  plan: PlanType;        // Subscription plan
  tier: TierType;        // API tier
  capabilities: Capability[];
  quotas: TokenQuotas;
  org?: string;          // Organization name
  env?: 'production' | 'staging' | 'development';
}

export type PlanType = 'starter' | 'professional' | 'enterprise' | 'trial';
export type TierType = 'standard' | 'priority' | 'dedicated';

export interface TokenQuotas {
  simulationsPerMonth: number;
  maxEntitiesPerSimulation: number;
  maxStepsPerSimulation: number;
  maxConcurrentSimulations: number;
  maxWorkers: number;
  retentionDays: number;
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: TokenPayload;
  error?: string;
}

export interface QuotaStatus {
  simulationsUsed: number;
  simulationsLimit: number;
  resetsAt: Date;
  remainingPercentage: number;
}

// =============================================================================
// Token Constants
// =============================================================================

const TOKEN_PREFIX = 'vx_';
const TOKEN_LIVE_PREFIX = 'vx_live_';
const TOKEN_TEST_PREFIX = 'vx_test_';
const TOKEN_MIN_LENGTH = 32;
const TOKEN_MAX_LENGTH = 256;

// Demo token for documentation examples (never valid for actual API calls)
const DEMO_TOKEN_PREFIX = 'vx_demo_';

// =============================================================================
// Auth Manager Class
// =============================================================================

export class AuthManager {
  private token: string | null = null;
  private payload: TokenPayload | null = null;
  private validated = false;
  private logger?: ILogger;

  constructor(logger?: ILogger) {
    this.logger = logger;
  }

  /**
   * Set the API token
   */
  setToken(token: string | undefined | null): void {
    if (!token) {
      this.token = null;
      this.payload = null;
      this.validated = false;
      return;
    }

    const trimmed = token.trim();
    this.validateTokenFormat(trimmed);
    this.token = trimmed;
    this.payload = null;
    this.validated = false;
  }

  /**
   * Get the current token
   */
  getToken(): string {
    if (!this.token) {
      throw new TokenMissingError();
    }
    return this.token;
  }

  /**
   * Check if token is set
   */
  hasToken(): boolean {
    return this.token !== null;
  }

  /**
   * Validate token format (synchronous check)
   */
  private validateTokenFormat(token: string): void {
    if (token.length < TOKEN_MIN_LENGTH) {
      throw new TokenInvalidError('Token is too short');
    }

    if (token.length > TOKEN_MAX_LENGTH) {
      throw new TokenInvalidError('Token is too long');
    }

    const validPrefixes = [TOKEN_PREFIX, TOKEN_LIVE_PREFIX, TOKEN_TEST_PREFIX, DEMO_TOKEN_PREFIX];
    const hasValidPrefix = validPrefixes.some(prefix => token.startsWith(prefix));

    if (!hasValidPrefix) {
      throw new TokenInvalidError(
        `Token must start with one of: ${validPrefixes.join(', ')}`
      );
    }

    // Check for invalid characters
    const tokenBody = token.slice(token.indexOf('_', 3) + 1);
    if (!/^[a-zA-Z0-9_-]+$/.test(tokenBody)) {
      throw new TokenInvalidError('Token contains invalid characters');
    }
  }

  /**
   * Validate token with API (async check)
   * In mock mode, this simulates token validation
   */
  async validateToken(): Promise<TokenPayload> {
    if (!this.token) {
      throw new TokenMissingError();
    }

    // If already validated and payload exists, return cached
    if (this.validated && this.payload) {
      this.checkExpiration(this.payload);
      return this.payload;
    }

    this.logger?.debug('Validating API token...', { tokenPrefix: this.token.slice(0, 8) });

    // Simulate API validation delay
    await this.simulateNetworkDelay();

    // Demo tokens are never valid
    if (this.token.startsWith(DEMO_TOKEN_PREFIX)) {
      throw new TokenInvalidError(
        'Demo tokens are for documentation purposes only and cannot be used for API calls'
      );
    }

    // Mock token validation - decode "payload" from token
    const payload = this.mockDecodeToken(this.token);

    // Check expiration
    this.checkExpiration(payload);

    this.payload = payload;
    this.validated = true;

    this.logger?.info('Token validated successfully', {
      plan: payload.plan,
      tier: payload.tier,
      org: payload.org,
    });

    return payload;
  }

  /**
   * Get token payload (must be validated first)
   */
  getPayload(): TokenPayload {
    if (!this.payload) {
      throw new TokenInvalidError('Token has not been validated');
    }
    return this.payload;
  }

  /**
   * Check if token has specific capability
   */
  hasCapability(capability: Capability): boolean {
    if (!this.payload) return false;
    return this.payload.capabilities.includes(capability);
  }

  /**
   * Get quota limits
   */
  getQuotas(): TokenQuotas {
    if (!this.payload) {
      throw new TokenInvalidError('Token has not been validated');
    }
    return this.payload.quotas;
  }

  /**
   * Check quota and throw if exceeded
   */
  checkQuota(type: keyof TokenQuotas, current: number): void {
    if (!this.payload) {
      throw new TokenInvalidError('Token has not been validated');
    }

    const limit = this.payload.quotas[type];
    if (typeof limit === 'number' && current >= limit) {
      throw new QuotaExceededError(type, limit, current);
    }
  }

  /**
   * Get masked token for logging
   */
  getMaskedToken(): string {
    if (!this.token) return '<no token>';
    const prefix = this.token.slice(0, 8);
    const suffix = this.token.slice(-4);
    return `${prefix}...${suffix}`;
  }

  /**
   * Clear token and cached data
   */
  clear(): void {
    this.token = null;
    this.payload = null;
    this.validated = false;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private checkExpiration(payload: TokenPayload): void {
    const now = Date.now() / 1000;
    if (payload.exp < now) {
      throw new TokenExpiredError(new Date(payload.exp * 1000));
    }
  }

  private async simulateNetworkDelay(): Promise<void> {
    // Simulate realistic API latency (50-150ms)
    const delay = 50 + Math.random() * 100;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private mockDecodeToken(token: string): TokenPayload {
    // Generate deterministic mock payload based on token hash
    const hash = this.simpleHash(token);
    const now = Date.now() / 1000;

    // Determine plan from token prefix patterns
    let plan: PlanType = 'starter';
    let tier: TierType = 'standard';
    const capabilities: Capability[] = ['deterministic', 'replay'];

    if (token.includes('ent') || token.includes('enterprise')) {
      plan = 'enterprise';
      tier = 'dedicated';
      capabilities.push('distributed', 'gpu-acceleration', 'edge-case-gen', 'streaming');
    } else if (token.includes('pro') || token.includes('professional')) {
      plan = 'professional';
      tier = 'priority';
      capabilities.push('distributed', 'edge-case-gen');
    } else if (token.includes('trial')) {
      plan = 'trial';
    }

    // Use live/test prefix to determine environment
    const env = token.startsWith(TOKEN_LIVE_PREFIX)
      ? 'production'
      : token.startsWith(TOKEN_TEST_PREFIX)
        ? 'staging'
        : 'development';

    return {
      sub: `usr_${hash.slice(0, 16)}`,
      iss: 'https://auth.vectrix.dev',
      iat: now - 3600,
      exp: now + 86400 * 30, // 30 days from now
      plan,
      tier,
      capabilities,
      org: `org_${hash.slice(16, 24)}`,
      env,
      quotas: this.getQuotasForPlan(plan),
    };
  }

  private getQuotasForPlan(plan: PlanType): TokenQuotas {
    switch (plan) {
      case 'enterprise':
        return {
          simulationsPerMonth: -1, // Unlimited
          maxEntitiesPerSimulation: 10000,
          maxStepsPerSimulation: 1000000,
          maxConcurrentSimulations: 100,
          maxWorkers: 64,
          retentionDays: 365,
        };
      case 'professional':
        return {
          simulationsPerMonth: 10000,
          maxEntitiesPerSimulation: 1000,
          maxStepsPerSimulation: 100000,
          maxConcurrentSimulations: 10,
          maxWorkers: 8,
          retentionDays: 90,
        };
      case 'trial':
        return {
          simulationsPerMonth: 100,
          maxEntitiesPerSimulation: 50,
          maxStepsPerSimulation: 1000,
          maxConcurrentSimulations: 1,
          maxWorkers: 1,
          retentionDays: 7,
        };
      case 'starter':
      default:
        return {
          simulationsPerMonth: 1000,
          maxEntitiesPerSimulation: 100,
          maxStepsPerSimulation: 10000,
          maxConcurrentSimulations: 2,
          maxWorkers: 2,
          retentionDays: 30,
        };
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(32, '0');
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get API token from environment
 */
export function getTokenFromEnv(): string | undefined {
  // Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env['VECTRIX_API_TOKEN'];
  }
  return undefined;
}

/**
 * Check if running in test mode
 */
export function isTestMode(token?: string): boolean {
  if (!token) return false;
  return token.startsWith(TOKEN_TEST_PREFIX);
}

/**
 * Check if running in demo mode
 */
export function isDemoMode(token?: string): boolean {
  if (!token) return false;
  return token.startsWith(DEMO_TOKEN_PREFIX);
}

/**
 * Create a test token for development (only works in test environment)
 */
export function createTestToken(options?: {
  plan?: PlanType;
  capabilities?: Capability[];
}): string {
  const plan = options?.plan || 'professional';
  const suffix = Math.random().toString(36).substring(2, 18);
  return `vx_test_${plan}_${suffix}`;
}

