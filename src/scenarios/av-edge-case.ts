/**
 * VECTRIX SDK Autonomous Vehicle Edge-Case Scenario
 * @module @vectrix/sdk/scenarios
 */

import type {
  ScenarioBuildResult,
  ValidationErrorInfo,
  ValidationWarning,
  EntityDescriptor,
  Vector3,
  Action,
} from '../core/types';
import { Scenario, validateRange } from './base';

// =============================================================================
// Types
// =============================================================================

export interface AVEdgeCaseConfig {
  vehicleCount: number;
  pedestrianCount: number;
  roadNetwork: RoadNetworkType;
  weatherConditions: WeatherCondition;
  fuzzingMode: FuzzingMode;
  oracleChecks: OracleCheck[];
  lightingCondition?: LightingCondition;
  trafficDensity?: number;
  egoVehiclePosition?: Vector3;
  scenarioSeed?: number;
  // todo: Add more edge-case generation options
}

export type RoadNetworkType =
  | 'straight-road'
  | 'urban-intersection'
  | 'highway-merge'
  | 'roundabout'
  | 't-junction'
  | 'parking-lot'
  | 'construction-zone';

export type WeatherCondition =
  | 'clear'
  | 'rain'
  | 'heavy-rain'
  | 'fog'
  | 'snow'
  | 'ice'
  | 'night';

export type FuzzingMode =
  | 'random'
  | 'adversarial'
  | 'coverage'
  | 'boundary'
  | 'mutation';

export type OracleCheck =
  | 'no-collision'
  | 'lane-keep'
  | 'speed-limit'
  | 'safe-distance'
  | 'traffic-rules'
  | 'pedestrian-yield'
  | 'signal-compliance';

export type LightingCondition =
  | 'daylight'
  | 'dusk'
  | 'night'
  | 'glare';

// =============================================================================
// AV Edge-Case Scenario
// =============================================================================

export class AVEdgeCaseScenario extends Scenario {
  readonly type = 'av-edge-case' as const;
  readonly config: AVEdgeCaseConfig;

  constructor(config: AVEdgeCaseConfig) {
    super();
    this.config = {
      lightingCondition: 'daylight',
      trafficDensity: 0.5,
      scenarioSeed: Date.now(),
      ...config,
    };
  }

  build(): ScenarioBuildResult {
    const entities: EntityDescriptor[] = [];
    const initialActions: Action[] = [];

    // Create road network
    const roadNetwork = this.generateRoadNetwork();
    const dimensions = this.getRoadNetworkDimensions();

    const worldConfig = this.createWorldConfig(
      dimensions,
      { x: 0, y: -9.81, z: 0 }
    );

    // Add road entities
    entities.push(...roadNetwork.roads);
    entities.push(...roadNetwork.signals);
    entities.push(...roadNetwork.signs);

    // Add ego vehicle (the AV being tested)
    const egoVehicle = this.createEgoVehicle();
    entities.push(egoVehicle);

    // Add other vehicles
    const vehicles = this.generateVehicles(roadNetwork);
    entities.push(...vehicles);

    // Add pedestrians
    const pedestrians = this.generatePedestrians(roadNetwork);
    entities.push(...pedestrians);

    // Generate edge-case scenarios based on fuzzing mode
    const edgeCaseActions = this.generateEdgeCaseActions(
      egoVehicle,
      vehicles,
      pedestrians
    );
    initialActions.push(...edgeCaseActions);

    return {
      entities,
      worldConfig,
      initialActions,
      metadata: {
        scenarioType: 'av-edge-case',
        roadNetwork: this.config.roadNetwork,
        weather: this.config.weatherConditions,
        lighting: this.config.lightingCondition,
        fuzzingMode: this.config.fuzzingMode,
        oracleChecks: this.config.oracleChecks,
        vehicleCount: vehicles.length + 1,
        pedestrianCount: pedestrians.length,
        seed: this.config.scenarioSeed,
      },
    };
  }

  protected validateConfig(
    errors: ValidationErrorInfo[],
    warnings: ValidationWarning[]
  ): void {
    validateRange(this.config.vehicleCount, 'vehicleCount', 0, 50, errors);
    validateRange(this.config.pedestrianCount, 'pedestrianCount', 0, 100, errors);

    if (this.config.oracleChecks.length === 0) {
      warnings.push({
        code: 'NO_ORACLE_CHECKS',
        message: 'No oracle checks specified; simulation will not validate behavior',
        field: 'oracleChecks',
      });
    }

    if (this.config.fuzzingMode === 'adversarial') {
      warnings.push({
        code: 'ADVERSARIAL_MODE',
        message: 'Adversarial fuzzing may generate extreme edge cases',
        field: 'fuzzingMode',
      });
    }
  }

  // ===========================================================================
  // Road Network Generation
  // ===========================================================================

  private getRoadNetworkDimensions(): Vector3 {
    switch (this.config.roadNetwork) {
      case 'straight-road':
        return { x: 200, y: 10, z: 20 };
      case 'urban-intersection':
        return { x: 100, y: 10, z: 100 };
      case 'highway-merge':
        return { x: 300, y: 10, z: 40 };
      case 'roundabout':
        return { x: 80, y: 10, z: 80 };
      case 't-junction':
        return { x: 80, y: 10, z: 60 };
      case 'parking-lot':
        return { x: 60, y: 10, z: 80 };
      case 'construction-zone':
        return { x: 150, y: 10, z: 30 };
      default:
        return { x: 100, y: 10, z: 100 };
    }
  }

  private generateRoadNetwork(): {
    roads: EntityDescriptor[];
    signals: EntityDescriptor[];
    signs: EntityDescriptor[];
  } {
    const roads: EntityDescriptor[] = [];
    const signals: EntityDescriptor[] = [];
    const signs: EntityDescriptor[] = [];

    switch (this.config.roadNetwork) {
      case 'urban-intersection':
        // Main road (east-west)
        roads.push(this.createEntity('zone', { x: 0, y: 0.01, z: 0 }, {
          customData: { type: 'road', lanes: 4, direction: 'east-west' },
        }));
        // Cross road (north-south)
        roads.push(this.createEntity('zone', { x: 0, y: 0.01, z: 0 }, {
          customData: { type: 'road', lanes: 2, direction: 'north-south' },
        }));
        // Traffic signals
        signals.push(this.createEntity('sensor', { x: -15, y: 3, z: -15 }, {
          customData: { type: 'traffic-light', state: 'red', cycle: 30 },
        }));
        signals.push(this.createEntity('sensor', { x: 15, y: 3, z: 15 }, {
          customData: { type: 'traffic-light', state: 'green', cycle: 30 },
        }));
        break;

      case 'highway-merge':
        roads.push(this.createEntity('zone', { x: 0, y: 0.01, z: 0 }, {
          customData: { type: 'highway', lanes: 3, speedLimit: 120 },
        }));
        roads.push(this.createEntity('zone', { x: -100, y: 0.01, z: 15 }, {
          customData: { type: 'ramp', lanes: 1, mergePoint: 0 },
        }));
        signs.push(this.createEntity('waypoint', { x: -80, y: 2, z: 15 }, {
          customData: { type: 'sign', content: 'MERGE' },
        }));
        break;

      default:
        roads.push(this.createEntity('zone', { x: 0, y: 0.01, z: 0 }, {
          customData: { type: 'road', lanes: 2 },
        }));
    }

    return { roads, signals, signs };
  }

  // ===========================================================================
  // Entity Generation
  // ===========================================================================

  private createEgoVehicle(): EntityDescriptor {
    const position = this.config.egoVehiclePosition ?? { x: -40, y: 0.5, z: 0 };

    return this.createEntity(
      'vehicle',
      position,
      {
        mass: 1500,
        friction: 0.9,
        collisionRadius: 2.5,
        maxVelocity: 40,
        maxAcceleration: 8,
        controlMode: 'velocity',
        customData: {
          vehicleType: 'ego',
          sensors: ['lidar', 'camera', 'radar'],
          autonomyLevel: 4,
        },
      },
      {
        isEgo: true,
        targetSpeed: 15,
        targetLane: 0,
      }
    );
  }

  private generateVehicles(_roadNetwork: { roads: EntityDescriptor[] }): EntityDescriptor[] {
    const vehicles: EntityDescriptor[] = [];
    const dimensions = this.getRoadNetworkDimensions();

    for (let i = 0; i < this.config.vehicleCount; i++) {
      const lane = i % 4;
      const x = -dimensions.x / 2 + (i + 2) * (dimensions.x / (this.config.vehicleCount + 3));
      const z = (lane - 1.5) * 3.5;

      vehicles.push(this.createEntity(
        'vehicle',
        { x, y: 0.5, z },
        {
          mass: 1200 + Math.random() * 800,
          friction: 0.85,
          collisionRadius: 2,
          maxVelocity: 30 + Math.random() * 20,
          maxAcceleration: 5 + Math.random() * 5,
          controlMode: 'velocity',
          customData: {
            vehicleType: this.randomVehicleType(),
            behavior: this.randomBehaviorProfile(),
          },
        },
        {
          vehicleIndex: i,
          lane,
          initialSpeed: 10 + Math.random() * 15,
        }
      ));
    }

    return vehicles;
  }

  private generatePedestrians(_roadNetwork: { roads: EntityDescriptor[] }): EntityDescriptor[] {
    const pedestrians: EntityDescriptor[] = [];
    const dimensions = this.getRoadNetworkDimensions();

    for (let i = 0; i < this.config.pedestrianCount; i++) {
      // Place pedestrians on sidewalks
      const side = i % 2 === 0 ? 1 : -1;
      const x = -dimensions.x / 2 + (i + 1) * (dimensions.x / (this.config.pedestrianCount + 1));
      const z = side * (dimensions.z / 2 - 2);

      pedestrians.push(this.createEntity(
        'pedestrian',
        { x, y: 0.9, z },
        {
          mass: 70,
          friction: 0.5,
          collisionRadius: 0.3,
          maxVelocity: 1.5 + Math.random() * 1,
          maxAcceleration: 3,
          controlMode: 'velocity',
          customData: {
            pedestrianType: this.randomPedestrianType(),
            attention: 0.5 + Math.random() * 0.5,
            crossingIntent: Math.random() > 0.7,
          },
        },
        {
          pedestrianIndex: i,
          sidewalk: side > 0 ? 'north' : 'south',
        }
      ));
    }

    return pedestrians;
  }

  // ===========================================================================
  // Edge-Case Generation
  // ===========================================================================

  private generateEdgeCaseActions(
    ego: EntityDescriptor,
    vehicles: EntityDescriptor[],
    pedestrians: EntityDescriptor[]
  ): Action[] {
    const actions: Action[] = [];

    switch (this.config.fuzzingMode) {
      case 'adversarial':
        // Create challenging scenarios
        actions.push(...this.generateAdversarialActions(ego, vehicles, pedestrians));
        break;

      case 'boundary':
        // Test boundary conditions
        actions.push(...this.generateBoundaryActions(vehicles, pedestrians));
        break;

      case 'mutation':
        // Mutate normal behaviors
        actions.push(...this.generateMutationActions(vehicles, pedestrians));
        break;

      case 'coverage':
      case 'random':
      default:
        // Random but varied scenarios
        actions.push(...this.generateRandomActions(vehicles, pedestrians));
    }

    return actions;
  }

  private generateAdversarialActions(
    ego: EntityDescriptor,
    vehicles: EntityDescriptor[],
    pedestrians: EntityDescriptor[]
  ): Action[] {
    const actions: Action[] = [];
    const egoPos = ego.transform.position;

    // Vehicle suddenly braking in front
    if (vehicles.length > 0) {
      const frontVehicle = vehicles[0]!;
      actions.push({
        entityId: frontVehicle.id,
        type: 'set_velocity',
        parameters: { velocity: { x: -5, y: 0, z: 0 } }, // Sudden brake
        timestamp: 2000,
      });
    }

    // Pedestrian jaywalking
    for (let i = 0; i < Math.min(3, pedestrians.length); i++) {
      const ped = pedestrians[i]!;
      if (ped.metadata?.['crossingIntent']) {
        actions.push({
          entityId: ped.id,
          type: 'move_to',
          parameters: {
            target: {
              x: ped.transform.position.x,
              y: 0.9,
              z: -ped.transform.position.z, // Cross to other side
            },
          },
          timestamp: 1000 + i * 500,
        });
      }
    }

    // Vehicle cutting in
    if (vehicles.length > 1) {
      const cuttingVehicle = vehicles[1]!;
      actions.push({
        entityId: cuttingVehicle.id,
        type: 'move_to',
        parameters: {
          target: {
            x: egoPos.x + 10,
            y: 0.5,
            z: egoPos.z,
          },
        },
        timestamp: 1500,
      });
    }

    return actions;
  }

  private generateBoundaryActions(
    vehicles: EntityDescriptor[],
    pedestrians: EntityDescriptor[]
  ): Action[] {
    const actions: Action[] = [];

    // Test speed limits
    for (const vehicle of vehicles.slice(0, 3)) {
      actions.push({
        entityId: vehicle.id,
        type: 'set_velocity',
        parameters: { velocity: { x: 35, y: 0, z: 0 } }, // Near speed limit
        timestamp: 0,
      });
    }

    // Test minimum distance
    for (const ped of pedestrians.slice(0, 2)) {
      actions.push({
        entityId: ped.id,
        type: 'set_velocity',
        parameters: { velocity: { x: 0, y: 0, z: 2 } }, // Walk toward road edge
        timestamp: 500,
      });
    }

    return actions;
  }

  private generateMutationActions(
    vehicles: EntityDescriptor[],
    _pedestrians: EntityDescriptor[]
  ): Action[] {
    const actions: Action[] = [];

    // Slight deviations from normal behavior
    for (const vehicle of vehicles) {
      const mutation = (Math.random() - 0.5) * 5;
      actions.push({
        entityId: vehicle.id,
        type: 'set_velocity',
        parameters: {
          velocity: {
            x: 15 + mutation,
            y: 0,
            z: mutation * 0.1,
          },
        },
        timestamp: Math.random() * 3000,
      });
    }

    return actions;
  }

  private generateRandomActions(
    vehicles: EntityDescriptor[],
    pedestrians: EntityDescriptor[]
  ): Action[] {
    const actions: Action[] = [];

    for (const vehicle of vehicles) {
      actions.push({
        entityId: vehicle.id,
        type: 'set_velocity',
        parameters: {
          velocity: {
            x: 10 + Math.random() * 20,
            y: 0,
            z: (Math.random() - 0.5) * 2,
          },
        },
        timestamp: Math.random() * 1000,
      });
    }

    for (const ped of pedestrians) {
      if (Math.random() > 0.5) {
        actions.push({
          entityId: ped.id,
          type: 'set_velocity',
          parameters: {
            velocity: {
              x: (Math.random() - 0.5) * 2,
              y: 0,
              z: (Math.random() - 0.5) * 2,
            },
          },
          timestamp: Math.random() * 2000,
        });
      }
    }

    return actions;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private randomVehicleType(): string {
    const types = ['sedan', 'suv', 'truck', 'motorcycle', 'bus', 'van'];
    return types[Math.floor(Math.random() * types.length)]!;
  }

  private randomBehaviorProfile(): string {
    const profiles = ['cautious', 'normal', 'aggressive', 'distracted'];
    return profiles[Math.floor(Math.random() * profiles.length)]!;
  }

  private randomPedestrianType(): string {
    const types = ['adult', 'child', 'elderly', 'cyclist', 'jogger'];
    return types[Math.floor(Math.random() * types.length)]!;
  }
}

