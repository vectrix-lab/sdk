/**
 * VECTRIX SDK Tracing and Profiling
 * @module @vectrix/sdk/logging
 */

import type { ILogger, LogLevel, LogEntry, SimulationEvent } from '../core/types';

// =============================================================================
// Types
// =============================================================================

export interface TraceSpan {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  parentId?: string;
  tags: Record<string, string | number | boolean>;
  events: TraceEvent[];
  status: 'running' | 'completed' | 'error';
}

export interface TraceEvent {
  timestamp: number;
  name: string;
  attributes?: Record<string, unknown>;
}

export interface ProfilerMetrics {
  stepTimes: number[];
  moduleTimes: Record<string, number[]>;
  peakMemory: number;
  gcPauses: number[];
  hotspots: ProfilerHotspot[];
}

export interface ProfilerHotspot {
  name: string;
  totalTime: number;
  callCount: number;
  avgTime: number;
  percentage: number;
}

// =============================================================================
// Console Logger
// =============================================================================

export class ConsoleLogger implements ILogger {
  private readonly prefix: string;
  private readonly minLevel: LogLevel;
  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(prefix = 'VECTRIX', minLevel: LogLevel = 'info') {
    this.prefix = prefix;
    this.minLevel = minLevel;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (this.levels[level] < this.levels[this.minLevel]) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${this.prefix}:${level.toUpperCase()}]`;

    const logFn = level === 'error' ? console.error :
                  level === 'warn' ? console.warn :
                  level === 'debug' ? console.debug : console.log;

    if (data && Object.keys(data).length > 0) {
      logFn(`${timestamp} ${prefix} ${message}`, data);
    } else {
      logFn(`${timestamp} ${prefix} ${message}`);
    }
  }
}

// =============================================================================
// Buffered Logger
// =============================================================================

export class BufferedLogger implements ILogger {
  private readonly buffer: LogEntry[] = [];
  private readonly maxSize: number;
  private readonly flushCallback?: (entries: LogEntry[]) => void;

  constructor(maxSize = 1000, flushCallback?: (entries: LogEntry[]) => void) {
    this.maxSize = maxSize;
    this.flushCallback = flushCallback;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.addEntry('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.addEntry('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.addEntry('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.addEntry('error', message, data);
  }

  private addEntry(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category: 'default',
      message,
      data,
    };

    this.buffer.push(entry);

    if (this.buffer.length >= this.maxSize) {
      this.flush();
    }
  }

  getEntries(): readonly LogEntry[] {
    return this.buffer;
  }

  flush(): LogEntry[] {
    const entries = [...this.buffer];
    this.buffer.length = 0;
    this.flushCallback?.(entries);
    return entries;
  }

  clear(): void {
    this.buffer.length = 0;
  }
}

// =============================================================================
// Event Bus
// =============================================================================

export class EventBus {
  private readonly handlers = new Map<string, Set<(event: SimulationEvent) => void>>();
  private readonly eventLog: SimulationEvent[] = [];
  private readonly maxLogSize: number;

  constructor(maxLogSize = 10000) {
    this.maxLogSize = maxLogSize;
  }

  subscribe(eventType: string, handler: (event: SimulationEvent) => void): () => void {
    let handlers = this.handlers.get(eventType);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(eventType, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers?.delete(handler);
    };
  }

  subscribeAll(handler: (event: SimulationEvent) => void): () => void {
    return this.subscribe('*', handler);
  }

  emit(event: SimulationEvent): void {
    // Log event
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    // Notify specific handlers
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      }
    }

    // Notify wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler(event);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      }
    }
  }

  getEventLog(): readonly SimulationEvent[] {
    return this.eventLog;
  }

  getEventsByType(type: string): SimulationEvent[] {
    return this.eventLog.filter(e => e.type === type);
  }

  clear(): void {
    this.eventLog.length = 0;
  }
}

// =============================================================================
// Tracer
// =============================================================================

export class Tracer {
  private readonly spans: Map<string, TraceSpan> = new Map();
  private readonly completedSpans: TraceSpan[] = [];
  private spanIdCounter = 0;

  startSpan(name: string, parentId?: string): TraceSpan {
    const id = `span_${(this.spanIdCounter++).toString(36)}`;
    const span: TraceSpan = {
      id,
      name,
      startTime: performance.now(),
      parentId,
      tags: {},
      events: [],
      status: 'running',
    };

    this.spans.set(id, span);
    return span;
  }

  endSpan(spanOrId: TraceSpan | string): TraceSpan | undefined {
    const id = typeof spanOrId === 'string' ? spanOrId : spanOrId.id;
    const span = this.spans.get(id);

    if (span) {
      span.endTime = performance.now();
      span.duration = span.endTime - span.startTime;
      span.status = 'completed';
      this.spans.delete(id);
      this.completedSpans.push(span);
    }

    return span;
  }

  addEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.events.push({
        timestamp: performance.now(),
        name,
        attributes,
      });
    }
  }

  setTag(spanId: string, key: string, value: string | number | boolean): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  getActiveSpans(): TraceSpan[] {
    return Array.from(this.spans.values());
  }

  getCompletedSpans(): readonly TraceSpan[] {
    return this.completedSpans;
  }

  exportJSON(): string {
    return JSON.stringify({
      activeSpans: Array.from(this.spans.values()),
      completedSpans: this.completedSpans,
    }, null, 2);
  }

  clear(): void {
    this.spans.clear();
    this.completedSpans.length = 0;
  }
}

// =============================================================================
// Profiler
// =============================================================================

export class Profiler {
  private readonly stepTimes: number[] = [];
  private readonly moduleTimes: Map<string, number[]> = new Map();
  private peakMemory = 0;
  private readonly gcPauses: number[] = [];
  private currentModule?: { name: string; startTime: number };

  recordStepTime(time: number): void {
    this.stepTimes.push(time);
  }

  startModule(name: string): void {
    this.currentModule = { name, startTime: performance.now() };
  }

  endModule(): void {
    if (!this.currentModule) return;

    const duration = performance.now() - this.currentModule.startTime;
    let times = this.moduleTimes.get(this.currentModule.name);
    if (!times) {
      times = [];
      this.moduleTimes.set(this.currentModule.name, times);
    }
    times.push(duration);
    this.currentModule = undefined;
  }

  recordMemory(memoryMb: number): void {
    if (memoryMb > this.peakMemory) {
      this.peakMemory = memoryMb;
    }
  }

  recordGCPause(pauseMs: number): void {
    this.gcPauses.push(pauseMs);
  }

  getMetrics(): ProfilerMetrics {
    const totalTime = this.stepTimes.reduce((a, b) => a + b, 0);
    const hotspots: ProfilerHotspot[] = [];

    for (const [name, times] of this.moduleTimes) {
      const moduleTotal = times.reduce((a, b) => a + b, 0);
      hotspots.push({
        name,
        totalTime: moduleTotal,
        callCount: times.length,
        avgTime: moduleTotal / times.length,
        percentage: (moduleTotal / totalTime) * 100,
      });
    }

    hotspots.sort((a, b) => b.totalTime - a.totalTime);

    return {
      stepTimes: [...this.stepTimes],
      moduleTimes: Object.fromEntries(this.moduleTimes),
      peakMemory: this.peakMemory,
      gcPauses: [...this.gcPauses],
      hotspots,
    };
  }

  getAverageStepTime(): number {
    if (this.stepTimes.length === 0) return 0;
    return this.stepTimes.reduce((a, b) => a + b, 0) / this.stepTimes.length;
  }

  getP99StepTime(): number {
    if (this.stepTimes.length === 0) return 0;
    const sorted = [...this.stepTimes].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.99);
    return sorted[index] ?? 0;
  }

  reset(): void {
    this.stepTimes.length = 0;
    this.moduleTimes.clear();
    this.peakMemory = 0;
    this.gcPauses.length = 0;
  }
}

// =============================================================================
// JSON Lines Exporter
// =============================================================================

export class JSONLExporter {
  private lines: string[] = [];

  addEntry(data: Record<string, unknown>): void {
    this.lines.push(JSON.stringify(data));
  }

  addLogEntry(entry: LogEntry): void {
    this.addEntry({
      type: 'log',
      ...entry,
    });
  }

  addSpan(span: TraceSpan): void {
    this.addEntry({
      type: 'span',
      ...span,
    });
  }

  addEvent(event: SimulationEvent): void {
    this.addEntry({
      entryType: 'event',
      eventType: event.type,
      ...event,
    });
  }

  export(): string {
    return this.lines.join('\n');
  }

  clear(): void {
    this.lines = [];
  }
}

