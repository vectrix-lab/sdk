/**
 * VECTRIX SDK Collision Broadphase
 * @module @vectrix/sdk/collision
 */

import type { EntityId, AABB, Vector3 } from '../core/types';
import { AABBOps } from '../world/transform';

// =============================================================================
// Types
// =============================================================================

export interface BroadphaseResult {
  pairs: CollisionPair[];
  checksPerformed: number;
}

export interface CollisionPair {
  entityA: EntityId;
  entityB: EntityId;
}

export interface BroadphaseBackend {
  readonly name: string;
  insert(id: EntityId, bounds: AABB): void;
  update(id: EntityId, bounds: AABB): void;
  remove(id: EntityId): void;
  queryPairs(): BroadphaseResult;
  queryPoint(point: Vector3): EntityId[];
  queryAABB(bounds: AABB): EntityId[];
  clear(): void;
}

// =============================================================================
// Simple Brute Force Broadphase
// =============================================================================

export class SimpleBroadphase implements BroadphaseBackend {
  readonly name = 'simple';
  private readonly entities = new Map<EntityId, AABB>();

  insert(id: EntityId, bounds: AABB): void {
    this.entities.set(id, bounds);
  }

  update(id: EntityId, bounds: AABB): void {
    this.entities.set(id, bounds);
  }

  remove(id: EntityId): void {
    this.entities.delete(id);
  }

  queryPairs(): BroadphaseResult {
    const pairs: CollisionPair[] = [];
    const entries = Array.from(this.entities.entries());
    let checks = 0;

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        checks++;
        const [idA, boundsA] = entries[i]!;
        const [idB, boundsB] = entries[j]!;

        if (AABBOps.intersects(boundsA, boundsB)) {
          pairs.push({ entityA: idA, entityB: idB });
        }
      }
    }

    return { pairs, checksPerformed: checks };
  }

  queryPoint(point: Vector3): EntityId[] {
    const result: EntityId[] = [];
    for (const [id, bounds] of this.entities) {
      if (AABBOps.contains(bounds, point)) {
        result.push(id);
      }
    }
    return result;
  }

  queryAABB(bounds: AABB): EntityId[] {
    const result: EntityId[] = [];
    for (const [id, entityBounds] of this.entities) {
      if (AABBOps.intersects(bounds, entityBounds)) {
        result.push(id);
      }
    }
    return result;
  }

  clear(): void {
    this.entities.clear();
  }
}

// =============================================================================
// Spatial Hash Broadphase
// =============================================================================

export class SpatialHashBroadphase implements BroadphaseBackend {
  readonly name = 'spatial-hash';
  private readonly cellSize: number;
  private readonly cells = new Map<string, Set<EntityId>>();
  private readonly entityBounds = new Map<EntityId, AABB>();
  private readonly entityCells = new Map<EntityId, string[]>();

  constructor(cellSize = 10) {
    this.cellSize = cellSize;
  }

  insert(id: EntityId, bounds: AABB): void {
    this.entityBounds.set(id, bounds);
    const cells = this.getCellsForBounds(bounds);
    this.entityCells.set(id, cells);

    for (const cell of cells) {
      let set = this.cells.get(cell);
      if (!set) {
        set = new Set();
        this.cells.set(cell, set);
      }
      set.add(id);
    }
  }

  update(id: EntityId, bounds: AABB): void {
    // Remove from old cells
    const oldCells = this.entityCells.get(id) ?? [];
    for (const cell of oldCells) {
      this.cells.get(cell)?.delete(id);
    }

    // Add to new cells
    this.entityBounds.set(id, bounds);
    const newCells = this.getCellsForBounds(bounds);
    this.entityCells.set(id, newCells);

    for (const cell of newCells) {
      let set = this.cells.get(cell);
      if (!set) {
        set = new Set();
        this.cells.set(cell, set);
      }
      set.add(id);
    }
  }

  remove(id: EntityId): void {
    const cells = this.entityCells.get(id) ?? [];
    for (const cell of cells) {
      this.cells.get(cell)?.delete(id);
    }
    this.entityBounds.delete(id);
    this.entityCells.delete(id);
  }

  queryPairs(): BroadphaseResult {
    const pairs = new Map<string, CollisionPair>();
    let checks = 0;

    // Check each cell for collisions
    for (const [_, entityIds] of this.cells) {
      const ids = Array.from(entityIds);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const idA = ids[i]!;
          const idB = ids[j]!;

          // Create consistent pair key
          const key = idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
          if (pairs.has(key)) continue;

          checks++;
          const boundsA = this.entityBounds.get(idA);
          const boundsB = this.entityBounds.get(idB);

          if (boundsA && boundsB && AABBOps.intersects(boundsA, boundsB)) {
            pairs.set(key, {
              entityA: idA < idB ? idA : idB,
              entityB: idA < idB ? idB : idA,
            });
          }
        }
      }
    }

    return { pairs: Array.from(pairs.values()), checksPerformed: checks };
  }

  queryPoint(point: Vector3): EntityId[] {
    const cell = this.getCellKey(point);
    const entityIds = this.cells.get(cell);
    if (!entityIds) return [];

    const result: EntityId[] = [];
    for (const id of entityIds) {
      const bounds = this.entityBounds.get(id);
      if (bounds && AABBOps.contains(bounds, point)) {
        result.push(id);
      }
    }
    return result;
  }

  queryAABB(bounds: AABB): EntityId[] {
    const cells = this.getCellsForBounds(bounds);
    const checked = new Set<EntityId>();
    const result: EntityId[] = [];

    for (const cell of cells) {
      const entityIds = this.cells.get(cell);
      if (!entityIds) continue;

      for (const id of entityIds) {
        if (checked.has(id)) continue;
        checked.add(id);

        const entityBounds = this.entityBounds.get(id);
        if (entityBounds && AABBOps.intersects(bounds, entityBounds)) {
          result.push(id);
        }
      }
    }

    return result;
  }

  clear(): void {
    this.cells.clear();
    this.entityBounds.clear();
    this.entityCells.clear();
  }

  private getCellKey(point: Vector3): string {
    const x = Math.floor(point.x / this.cellSize);
    const y = Math.floor(point.y / this.cellSize);
    const z = Math.floor(point.z / this.cellSize);
    return `${x},${y},${z}`;
  }

  private getCellsForBounds(bounds: AABB): string[] {
    const cells: string[] = [];
    const minX = Math.floor(bounds.min.x / this.cellSize);
    const maxX = Math.floor(bounds.max.x / this.cellSize);
    const minY = Math.floor(bounds.min.y / this.cellSize);
    const maxY = Math.floor(bounds.max.y / this.cellSize);
    const minZ = Math.floor(bounds.min.z / this.cellSize);
    const maxZ = Math.floor(bounds.max.z / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          cells.push(`${x},${y},${z}`);
        }
      }
    }

    return cells;
  }
}

// =============================================================================
// Sweep and Prune (SAP) Broadphase
// =============================================================================

interface SAPEntry {
  id: EntityId;
  bounds: AABB;
  minX: number;
  maxX: number;
}

export class SweepAndPruneBroadphase implements BroadphaseBackend {
  readonly name = 'sweep-and-prune';
  private entries: SAPEntry[] = [];
  private readonly entityMap = new Map<EntityId, number>();

  insert(id: EntityId, bounds: AABB): void {
    const entry: SAPEntry = {
      id,
      bounds,
      minX: bounds.min.x,
      maxX: bounds.max.x,
    };
    this.entityMap.set(id, this.entries.length);
    this.entries.push(entry);
  }

  update(id: EntityId, bounds: AABB): void {
    const index = this.entityMap.get(id);
    if (index !== undefined && this.entries[index]) {
      this.entries[index].bounds = bounds;
      this.entries[index].minX = bounds.min.x;
      this.entries[index].maxX = bounds.max.x;
    }
  }

  remove(id: EntityId): void {
    const index = this.entityMap.get(id);
    if (index !== undefined) {
      this.entries.splice(index, 1);
      this.entityMap.delete(id);

      // Update indices
      for (let i = index; i < this.entries.length; i++) {
        this.entityMap.set(this.entries[i]!.id, i);
      }
    }
  }

  queryPairs(): BroadphaseResult {
    // Sort by minX
    this.entries.sort((a, b) => a.minX - b.minX);

    const pairs: CollisionPair[] = [];
    let checks = 0;

    for (let i = 0; i < this.entries.length; i++) {
      const entryA = this.entries[i]!;

      for (let j = i + 1; j < this.entries.length; j++) {
        const entryB = this.entries[j]!;

        // If B's min is past A's max, no more possible collisions with A
        if (entryB.minX > entryA.maxX) break;

        checks++;

        // Full AABB test
        if (AABBOps.intersects(entryA.bounds, entryB.bounds)) {
          pairs.push({
            entityA: entryA.id < entryB.id ? entryA.id : entryB.id,
            entityB: entryA.id < entryB.id ? entryB.id : entryA.id,
          });
        }
      }
    }

    return { pairs, checksPerformed: checks };
  }

  queryPoint(point: Vector3): EntityId[] {
    return this.entries
      .filter(e => AABBOps.contains(e.bounds, point))
      .map(e => e.id);
  }

  queryAABB(bounds: AABB): EntityId[] {
    return this.entries
      .filter(e => AABBOps.intersects(bounds, e.bounds))
      .map(e => e.id);
  }

  clear(): void {
    this.entries = [];
    this.entityMap.clear();
  }
}

// =============================================================================
// Factory
// =============================================================================

export type BroadphaseType = 'simple' | 'spatial-hash' | 'sweep-and-prune';

export function createBroadphase(type: BroadphaseType, options?: { cellSize?: number }): BroadphaseBackend {
  switch (type) {
    case 'simple':
      return new SimpleBroadphase();
    case 'spatial-hash':
      return new SpatialHashBroadphase(options?.cellSize);
    case 'sweep-and-prune':
      return new SweepAndPruneBroadphase();
    default:
      return new SpatialHashBroadphase();
  }
}

