/**
 * VECTRIX SDK Error Classes
 * @module @vectrix/sdk/core
 */

export class VectrixError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'VectrixError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    Object.setPrototypeOf(this, VectrixError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

/**
 * Thrown when API token is missing or invalid
 */
export class AuthenticationError extends VectrixError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Thrown when API token is missing
 */
export class TokenMissingError extends AuthenticationError {
  constructor() {
    super(
      'API token is required. Please provide a valid VECTRIX API token via the apiToken option or VECTRIX_API_TOKEN environment variable. ' +
      'Visit https://vectrix.dev/dashboard to obtain your token.',
      { hint: 'Set VECTRIX_API_TOKEN environment variable or pass apiToken to VectrixClient' }
    );
    this.name = 'TokenMissingError';
    Object.setPrototypeOf(this, TokenMissingError.prototype);
  }
}

/**
 * Thrown when API token is invalid or expired
 */
export class TokenInvalidError extends AuthenticationError {
  constructor(reason?: string) {
    super(
      `Invalid API token${reason ? `: ${reason}` : ''}. Please check your token or generate a new one at https://vectrix.dev/dashboard`,
      { reason }
    );
    this.name = 'TokenInvalidError';
    Object.setPrototypeOf(this, TokenInvalidError.prototype);
  }
}

/**
 * Thrown when API token has expired
 */
export class TokenExpiredError extends AuthenticationError {
  constructor(expiredAt?: Date) {
    super(
      `API token has expired${expiredAt ? ` on ${expiredAt.toISOString()}` : ''}. Please renew your subscription or generate a new token at https://vectrix.dev/dashboard`,
      { expiredAt: expiredAt?.toISOString() }
    );
    this.name = 'TokenExpiredError';
    Object.setPrototypeOf(this, TokenExpiredError.prototype);
  }
}

/**
 * Thrown when API quota is exceeded
 */
export class QuotaExceededError extends VectrixError {
  public readonly quotaType: string;
  public readonly limit: number;
  public readonly current: number;
  public readonly resetsAt?: Date;

  constructor(
    quotaType: string,
    limit: number,
    current: number,
    resetsAt?: Date
  ) {
    super(
      `API quota exceeded for ${quotaType}. Current: ${current}, Limit: ${limit}. ` +
      (resetsAt ? `Resets at ${resetsAt.toISOString()}. ` : '') +
      'Consider upgrading your plan at https://vectrix.dev/pricing',
      'QUOTA_EXCEEDED',
      { quotaType, limit, current, resetsAt: resetsAt?.toISOString() }
    );
    this.name = 'QuotaExceededError';
    this.quotaType = quotaType;
    this.limit = limit;
    this.current = current;
    this.resetsAt = resetsAt;
    Object.setPrototypeOf(this, QuotaExceededError.prototype);
  }
}

/**
 * Thrown when simulation configuration is invalid
 */
export class ConfigurationError extends VectrixError {
  constructor(message: string, field?: string, details?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', { field, ...details });
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Thrown when simulation validation fails
 */
export class ValidationError extends VectrixError {
  public readonly validationErrors: Array<{ field: string; message: string }>;

  constructor(errors: Array<{ field: string; message: string }>) {
    const message = errors.length === 1
      ? `Validation failed: ${errors[0]?.message}`
      : `Validation failed with ${errors.length} errors`;
    super(message, 'VALIDATION_ERROR', { errors });
    this.name = 'ValidationError';
    this.validationErrors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Thrown when simulation diverges (NaN, Inf, etc.)
 */
export class DivergenceError extends VectrixError {
  public readonly step: number;
  public readonly entityId?: string;
  public readonly value?: number;

  constructor(
    message: string,
    step: number,
    entityId?: string,
    value?: number
  ) {
    super(message, 'DIVERGENCE_ERROR', { step, entityId, value });
    this.name = 'DivergenceError';
    this.step = step;
    this.entityId = entityId;
    this.value = value;
    Object.setPrototypeOf(this, DivergenceError.prototype);
  }
}

/**
 * Thrown when simulation times out
 */
export class TimeoutError extends VectrixError {
  public readonly timeoutMs: number;
  public readonly completedSteps: number;

  constructor(timeoutMs: number, completedSteps: number) {
    super(
      `Simulation timed out after ${timeoutMs}ms (completed ${completedSteps} steps)`,
      'TIMEOUT_ERROR',
      { timeoutMs, completedSteps }
    );
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.completedSteps = completedSteps;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Thrown when pathfinding fails
 */
export class PathfindingError extends VectrixError {
  public readonly entityId?: string;
  public readonly reason: string;

  constructor(reason: string, entityId?: string, details?: Record<string, unknown>) {
    super(
      `Pathfinding failed${entityId ? ` for entity ${entityId}` : ''}: ${reason}`,
      'PATHFINDING_ERROR',
      { entityId, reason, ...details }
    );
    this.name = 'PathfindingError';
    this.entityId = entityId;
    this.reason = reason;
    Object.setPrototypeOf(this, PathfindingError.prototype);
  }
}

/**
 * Thrown when collision detection fails
 */
export class CollisionError extends VectrixError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'COLLISION_ERROR', details);
    this.name = 'CollisionError';
    Object.setPrototypeOf(this, CollisionError.prototype);
  }
}

/**
 * Thrown when executor operation fails
 */
export class ExecutorError extends VectrixError {
  public readonly workerId?: string;

  constructor(message: string, workerId?: string, details?: Record<string, unknown>) {
    super(message, 'EXECUTOR_ERROR', { workerId, ...details });
    this.name = 'ExecutorError';
    this.workerId = workerId;
    Object.setPrototypeOf(this, ExecutorError.prototype);
  }
}

/**
 * Thrown when network request fails
 */
export class NetworkError extends VectrixError {
  public readonly statusCode?: number;
  public readonly endpoint?: string;

  constructor(
    message: string,
    statusCode?: number,
    endpoint?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'NETWORK_ERROR', { statusCode, endpoint, ...details });
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Thrown when repro pack is corrupted or incompatible
 */
export class ReproPackError extends VectrixError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'REPRO_PACK_ERROR', details);
    this.name = 'ReproPackError';
    Object.setPrototypeOf(this, ReproPackError.prototype);
  }
}

/**
 * Thrown when feature is not available in current plan/version
 */
export class FeatureNotAvailableError extends VectrixError {
  public readonly feature: string;
  public readonly requiredPlan?: string;

  constructor(feature: string, requiredPlan?: string) {
    super(
      `Feature "${feature}" is not available${requiredPlan ? `. Requires ${requiredPlan} plan` : ''}. ` +
      'Visit https://vectrix.dev/pricing for plan details.',
      'FEATURE_NOT_AVAILABLE',
      { feature, requiredPlan }
    );
    this.name = 'FeatureNotAvailableError';
    this.feature = feature;
    this.requiredPlan = requiredPlan;
    Object.setPrototypeOf(this, FeatureNotAvailableError.prototype);
  }
}

// =============================================================================
// Error Utilities
// =============================================================================

export function isVectrixError(error: unknown): error is VectrixError {
  return error instanceof VectrixError;
}

export function isAuthError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof NetworkError) {
    const code = error.statusCode;
    return code === 429 || code === 502 || code === 503 || code === 504;
  }
  if (error instanceof TimeoutError) {
    return true;
  }
  return false;
}

export function formatError(error: unknown): string {
  if (isVectrixError(error)) {
    return `[${error.code}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

