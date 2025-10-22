/**
 * VECTRIX SDK Warehouse Robotics Scenario
 * @module @vectrix/sdk/scenarios
 */

import type {
  ScenarioBuildResult,
  ValidationError,
  ValidationWarning,
  EntityDescriptor,
  Vector3,
  Action,
} from '../core/types';
import { Scenario, validateRange } from './base';

// =============================================================================
// Types
// =============================================================================

export interface WarehouseConfig {
  robotCount: number;
  warehouseLayout: WarehouseLayout;
  shelfDensity: number;
  aisleWidth: number;
  loadCapacity?: number;
  priorityRouting?: boolean;
  chargingStations?: number;
  pickupPoints?: number;
  deliveryPoints?: number;
  robotSpeed?: number;
  // todo: Add task queue configuration
}

export type WarehouseLayout =
  | 'grid-2x2'
  | 'grid-3x3'
  | 'grid-4x4'
  | 'fishbone'
  | 'diagonal'
  | 'custom';

export interface ShelfConfig {
  position: Vector3;
  size: Vector3;
  shelves: number;
  capacity: number;
}

// =============================================================================
// Warehouse Scenario
// =============================================================================

export class WarehouseScenario extends Scenario {
  readonly type = 'warehouse' as const;
  readonly config: WarehouseConfig;

  constructor(config: WarehouseConfig) {
    super();
    this.config = {
      loadCapacity: 500,
      priorityRouting: true,
      chargingStations: 4,
      pickupPoints: 8,
      deliveryPoints: 4,
      robotSpeed: 3,
      ...config,
    };
  }

  build(): ScenarioBuildResult {
    const entities: EntityDescriptor[] = [];
    const initialActions: Action[] = [];

    // Determine warehouse dimensions based on layout
    const dimensions = this.getLayoutDimensions();
    const worldConfig = this.createWorldConfig(
      dimensions,
      { x: 0, y: -9.81, z: 0 }
    );

    // Generate shelving units
    const shelves = this.generateShelves(dimensions);
    entities.push(...shelves);

    // Generate aisles (as waypoint zones)
    const aisles = this.generateAisles(dimensions);
    entities.push(...aisles);

    // Generate charging stations
    const chargingStations = this.generateChargingStations(dimensions);
    entities.push(...chargingStations);

    // Generate pickup/delivery points
    const pickupPoints = this.generatePickupPoints(dimensions);
    entities.push(...pickupPoints);

    const deliveryPoints = this.generateDeliveryPoints(dimensions);
    entities.push(...deliveryPoints);

    // Generate robots
    const robots = this.generateRobots(dimensions, chargingStations);
    entities.push(...robots);

    // Create initial actions (robots start at charging stations, then go to pickup)
    for (let i = 0; i < robots.length; i++) {
      const robot = robots[i]!;
      const pickup = pickupPoints[i % pickupPoints.length];

      if (pickup) {
        initialActions.push({
          entityId: robot.id,
          type: 'move_to',
          parameters: {
            target: pickup.transform.position,
            priority: this.config.priorityRouting ? i : 0,
          },
          timestamp: i * 500, // Stagger starts
        });
      }
    }

    return {
      entities,
      worldConfig,
      initialActions,
      metadata: {
        scenarioType: 'warehouse',
        robotCount: this.config.robotCount,
        layout: this.config.warehouseLayout,
        shelfCount: shelves.length,
        aisleCount: aisles.length,
        chargingStations: chargingStations.length,
        pickupPoints: pickupPoints.length,
        deliveryPoints: deliveryPoints.length,
      },
    };
  }

  protected validateConfig(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    validateRange(this.config.robotCount, 'robotCount', 1, 100, errors);
    validateRange(this.config.shelfDensity, 'shelfDensity', 0.1, 0.9, errors);
    validateRange(this.config.aisleWidth, 'aisleWidth', 2, 10, errors);

    if (this.config.robotCount > 50) {
      warnings.push({
        code: 'HIGH_ROBOT_COUNT',
        message: 'Robot count > 50 may require advanced coordination',
        field: 'robotCount',
      });
    }

    if (this.config.aisleWidth < 3) {
      warnings.push({
        code: 'NARROW_AISLES',
        message: 'Aisles < 3m may cause congestion',
        field: 'aisleWidth',
      });
    }
  }

  // ===========================================================================
  // Layout Generation
  // ===========================================================================

  private getLayoutDimensions(): Vector3 {
    switch (this.config.warehouseLayout) {
      case 'grid-2x2':
        return { x: 50, y: 10, z: 50 };
      case 'grid-3x3':
        return { x: 75, y: 10, z: 75 };
      case 'grid-4x4':
        return { x: 100, y: 10, z: 100 };
      case 'fishbone':
        return { x: 120, y: 10, z: 80 };
      case 'diagonal':
        return { x: 90, y: 10, z: 90 };
      default:
        return { x: 75, y: 10, z: 75 };
    }
  }

  private generateShelves(dimensions: Vector3): EntityDescriptor[] {
    const shelves: EntityDescriptor[] = [];
    const { shelfDensity, aisleWidth } = this.config;

    const shelfWidth = 2;
    const shelfDepth = 1;
    const shelfHeight = 4;

    const rows = Math.floor(dimensions.z / (shelfDepth + aisleWidth));
    const cols = Math.floor((dimensions.x * shelfDensity) / shelfWidth);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = -dimensions.x / 2 + col * (shelfWidth + 1) + shelfWidth / 2 + 5;
        const z = -dimensions.z / 2 + row * (shelfDepth + aisleWidth) + shelfDepth / 2 + 5;

        shelves.push(this.createObstacle(
          { x, y: shelfHeight / 2, z },
          { x: shelfWidth, y: shelfHeight, z: shelfDepth },
          { type: 'shelf', row, col, capacity: 100 }
        ));
      }
    }

    return shelves;
  }

  private generateAisles(dimensions: Vector3): EntityDescriptor[] {
    const aisles: EntityDescriptor[] = [];
    const { aisleWidth } = this.config;

    // Main aisles (vertical)
    const mainAisleCount = 3;
    for (let i = 0; i < mainAisleCount; i++) {
      const x = -dimensions.x / 2 + (i + 1) * (dimensions.x / (mainAisleCount + 1));
      aisles.push(this.createEntity(
        'zone',
        { x, y: 0.1, z: 0 },
        { customData: { type: 'main-aisle', width: aisleWidth } },
        { aisleType: 'main', index: i }
      ));
    }

    return aisles;
  }

  private generateChargingStations(dimensions: Vector3): EntityDescriptor[] {
    const stations: EntityDescriptor[] = [];
    const count = this.config.chargingStations ?? 4;

    // Place charging stations along one wall
    for (let i = 0; i < count; i++) {
      const x = -dimensions.x / 2 + (i + 1) * (dimensions.x / (count + 1));
      stations.push(this.createEntity(
        'zone',
        { x, y: 0.1, z: dimensions.z / 2 - 2 },
        { customData: { type: 'charging-station', capacity: 1 } },
        { stationType: 'charging', index: i }
      ));
    }

    return stations;
  }

  private generatePickupPoints(dimensions: Vector3): EntityDescriptor[] {
    const points: EntityDescriptor[] = [];
    const count = this.config.pickupPoints ?? 8;

    for (let i = 0; i < count; i++) {
      const x = -dimensions.x / 2 + (i + 1) * (dimensions.x / (count + 1));
      const z = -dimensions.z / 2 + 3;
      points.push(this.createEntity(
        'waypoint',
        { x, y: 0.1, z },
        { customData: { type: 'pickup', queueCapacity: 5 } },
        { pointType: 'pickup', index: i }
      ));
    }

    return points;
  }

  private generateDeliveryPoints(dimensions: Vector3): EntityDescriptor[] {
    const points: EntityDescriptor[] = [];
    const count = this.config.deliveryPoints ?? 4;

    for (let i = 0; i < count; i++) {
      const z = -dimensions.z / 2 + (i + 1) * (dimensions.z / (count + 1));
      points.push(this.createEntity(
        'waypoint',
        { x: dimensions.x / 2 - 3, y: 0.1, z },
        { customData: { type: 'delivery', queueCapacity: 10 } },
        { pointType: 'delivery', index: i }
      ));
    }

    return points;
  }

  private generateRobots(
    dimensions: Vector3,
    chargingStations: EntityDescriptor[]
  ): EntityDescriptor[] {
    const robots: EntityDescriptor[] = [];

    for (let i = 0; i < this.config.robotCount; i++) {
      // Start at charging stations
      const station = chargingStations[i % chargingStations.length];
      const position = station
        ? { ...station.transform.position, z: station.transform.position.z - 2 }
        : { x: 0, y: 0.5, z: dimensions.z / 2 - 5 };

      robots.push(this.createEntity(
        'robot',
        position,
        {
          mass: 100,
          friction: 0.8,
          collisionRadius: 0.5,
          maxVelocity: this.config.robotSpeed,
          maxAcceleration: 5,
          controlMode: 'velocity',
          customData: {
            loadCapacity: this.config.loadCapacity,
            currentLoad: 0,
            batteryLevel: 100,
            state: 'idle',
          },
        },
        {
          robotIndex: i,
          homeStation: i % chargingStations.length,
        }
      ));
    }

    return robots;
  }
}

