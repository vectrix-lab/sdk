/**
 * VECTRIX SDK Drone Swarm Scenario
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
import { Scenario, validateRange, validateVector3 } from './base';

// =============================================================================
// Types
// =============================================================================

export interface DroneSwarmConfig {
  droneCount: number;
  worldSize: Vector3;
  obstaclesDensity: number;
  collisionRadius?: number;
  maxVelocity?: number;
  maxAltitude?: number;
  formationType?: FormationType;
  plannerType?: 'astar' | 'rrt' | 'rrt-star';
  spawnPattern?: SpawnPattern;
  goalPattern?: GoalPattern;
  communicationRange?: number;
  // todo: Add more configuration options
}

export type FormationType =
  | 'swarm'
  | 'grid'
  | 'circle'
  | 'v-formation'
  | 'line'
  | 'random';

export type SpawnPattern =
  | 'clustered'
  | 'distributed'
  | 'edge'
  | 'random';

export type GoalPattern =
  | 'opposite'
  | 'center'
  | 'random'
  | 'formation';

// =============================================================================
// Drone Swarm Scenario
// =============================================================================

export class DroneSwarmScenario extends Scenario {
  readonly type = 'drone-swarm' as const;
  readonly config: DroneSwarmConfig;

  constructor(config: DroneSwarmConfig) {
    super();
    this.config = {
      collisionRadius: 2.5,
      maxVelocity: 15,
      maxAltitude: 200,
      formationType: 'swarm',
      plannerType: 'rrt-star',
      spawnPattern: 'distributed',
      goalPattern: 'opposite',
      communicationRange: 50,
      ...config,
    };
  }

  build(): ScenarioBuildResult {
    const entities: EntityDescriptor[] = [];
    const initialActions: Action[] = [];

    // Create world bounds
    const worldConfig = this.createWorldConfig(
      this.config.worldSize,
      { x: 0, y: 0, z: 0 } // Drones hover, no gravity effect
    );

    // Generate obstacles
    const obstacleCount = Math.floor(
      (this.config.worldSize.x * this.config.worldSize.z / 10000) *
      this.config.obstaclesDensity * 100
    );

    for (let i = 0; i < obstacleCount; i++) {
      const size = this.randomObstacleSize();
      const position = this.randomObstaclePosition(size);
      entities.push(this.createObstacle(position, size, { obstacleType: 'building' }));
    }

    // Generate drones
    const spawnPositions = this.generateSpawnPositions();
    const goalPositions = this.generateGoalPositions(spawnPositions);

    for (let i = 0; i < this.config.droneCount; i++) {
      const spawnPos = spawnPositions[i] ?? this.randomDronePosition();
      const goalPos = goalPositions[i] ?? this.randomDronePosition();

      const drone = this.createEntity(
        'drone',
        spawnPos,
        {
          mass: 2,
          collisionRadius: this.config.collisionRadius,
          maxVelocity: this.config.maxVelocity,
          maxAcceleration: 20,
          controlMode: 'velocity',
          customData: {
            droneIndex: i,
            formationSlot: i,
            communicationRange: this.config.communicationRange,
          },
        },
        {
          spawnPosition: spawnPos,
          goalPosition: goalPos,
          formationType: this.config.formationType,
        }
      );

      entities.push(drone);

      // Create initial action to move to goal
      initialActions.push({
        entityId: drone.id,
        type: 'move_to',
        parameters: { target: goalPos },
        timestamp: 0,
      });
    }

    return {
      entities,
      worldConfig,
      initialActions,
      metadata: {
        scenarioType: 'drone-swarm',
        droneCount: this.config.droneCount,
        obstacleCount,
        formationType: this.config.formationType,
        plannerType: this.config.plannerType,
      },
    };
  }

  protected validateConfig(
    errors: ValidationErrorInfo[],
    warnings: ValidationWarning[]
  ): void {
    validateRange(this.config.droneCount, 'droneCount', 1, 1000, errors);
    validateVector3(this.config.worldSize, 'worldSize', errors);
    validateRange(this.config.obstaclesDensity, 'obstaclesDensity', 0, 1, errors);

    if (this.config.droneCount > 500) {
      warnings.push({
        code: 'HIGH_DRONE_COUNT',
        message: 'Drone count > 500 may impact performance',
        field: 'droneCount',
      });
    }

    if (this.config.obstaclesDensity > 0.5) {
      warnings.push({
        code: 'HIGH_OBSTACLE_DENSITY',
        message: 'High obstacle density may make pathfinding difficult',
        field: 'obstaclesDensity',
      });
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private randomObstacleSize(): Vector3 {
    return {
      x: 10 + Math.random() * 30,
      y: 20 + Math.random() * 100,
      z: 10 + Math.random() * 30,
    };
  }

  private randomObstaclePosition(size: Vector3): Vector3 {
    const { worldSize } = this.config;
    return {
      x: (Math.random() - 0.5) * (worldSize.x - size.x),
      y: size.y / 2,
      z: (Math.random() - 0.5) * (worldSize.z - size.z),
    };
  }

  private randomDronePosition(): Vector3 {
    const { worldSize, maxAltitude = 200 } = this.config;
    return {
      x: (Math.random() - 0.5) * worldSize.x * 0.9,
      y: 20 + Math.random() * Math.min(maxAltitude - 20, worldSize.y - 20),
      z: (Math.random() - 0.5) * worldSize.z * 0.9,
    };
  }

  private generateSpawnPositions(): Vector3[] {
    const { droneCount, worldSize, spawnPattern = 'distributed' } = this.config;
    const positions: Vector3[] = [];

    switch (spawnPattern) {
      case 'clustered': {
        const clusterCenter = { x: -worldSize.x * 0.4, y: 50, z: -worldSize.z * 0.4 };
        for (let i = 0; i < droneCount; i++) {
          positions.push({
            x: clusterCenter.x + (Math.random() - 0.5) * 50,
            y: clusterCenter.y + (Math.random() - 0.5) * 30,
            z: clusterCenter.z + (Math.random() - 0.5) * 50,
          });
        }
        break;
      }
      case 'edge': {
        for (let i = 0; i < droneCount; i++) {
          const side = i % 4;
          const t = (i / droneCount) * worldSize.x;
          switch (side) {
            case 0: positions.push({ x: -worldSize.x / 2, y: 50, z: t - worldSize.z / 2 }); break;
            case 1: positions.push({ x: worldSize.x / 2, y: 50, z: t - worldSize.z / 2 }); break;
            case 2: positions.push({ x: t - worldSize.x / 2, y: 50, z: -worldSize.z / 2 }); break;
            case 3: positions.push({ x: t - worldSize.x / 2, y: 50, z: worldSize.z / 2 }); break;
          }
        }
        break;
      }
      case 'distributed':
      case 'random':
      default:
        for (let i = 0; i < droneCount; i++) {
          positions.push(this.randomDronePosition());
        }
    }

    return positions;
  }

  private generateGoalPositions(spawnPositions: Vector3[]): Vector3[] {
    const { droneCount, goalPattern = 'opposite' } = this.config;
    const positions: Vector3[] = [];

    switch (goalPattern) {
      case 'opposite':
        for (const spawn of spawnPositions) {
          positions.push({
            x: -spawn.x,
            y: spawn.y,
            z: -spawn.z,
          });
        }
        break;
      case 'center':
        for (let i = 0; i < droneCount; i++) {
          const angle = (i / droneCount) * Math.PI * 2;
          const radius = 20 + Math.random() * 30;
          positions.push({
            x: Math.cos(angle) * radius,
            y: 50 + Math.random() * 50,
            z: Math.sin(angle) * radius,
          });
        }
        break;
      case 'formation':
        positions.push(...this.generateFormationPositions());
        break;
      case 'random':
      default:
        for (let i = 0; i < droneCount; i++) {
          positions.push(this.randomDronePosition());
        }
    }

    return positions;
  }

  private generateFormationPositions(): Vector3[] {
    const { droneCount, formationType = 'grid' } = this.config;
    const positions: Vector3[] = [];
    const spacing = 10;

    switch (formationType) {
      case 'grid': {
        const cols = Math.ceil(Math.sqrt(droneCount));
        for (let i = 0; i < droneCount; i++) {
          const row = Math.floor(i / cols);
          const col = i % cols;
          positions.push({
            x: (col - cols / 2) * spacing,
            y: 50,
            z: (row - Math.ceil(droneCount / cols) / 2) * spacing,
          });
        }
        break;
      }
      case 'circle': {
        for (let i = 0; i < droneCount; i++) {
          const angle = (i / droneCount) * Math.PI * 2;
          const radius = droneCount * spacing / (2 * Math.PI);
          positions.push({
            x: Math.cos(angle) * radius,
            y: 50,
            z: Math.sin(angle) * radius,
          });
        }
        break;
      }
      case 'v-formation': {
        const angle = Math.PI / 6;
        for (let i = 0; i < droneCount; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const distance = Math.floor((i + 1) / 2) * spacing;
          positions.push({
            x: side * Math.sin(angle) * distance,
            y: 50,
            z: -Math.cos(angle) * distance,
          });
        }
        break;
      }
      case 'line': {
        for (let i = 0; i < droneCount; i++) {
          positions.push({
            x: (i - droneCount / 2) * spacing,
            y: 50,
            z: 0,
          });
        }
        break;
      }
      default:
        for (let i = 0; i < droneCount; i++) {
          positions.push(this.randomDronePosition());
        }
    }

    return positions;
  }
}

