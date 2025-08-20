/**
 * VECTRIX SDK Sensors Module
 * @module @vectrix/sdk/sensors
 */

import type {
  Vector3,
  Quaternion,
  SensorReading,
  SensorType,
  LidarData,
  IMUData,
  GPSData,
  ProximityData,
  AABB,
} from '../core/types';
import { Vec3, Quat } from '../world/transform';

// =============================================================================
// Types
// =============================================================================

export interface SensorConfig {
  id: string;
  type: SensorType;
  updateRate: number;
  noiseLevel?: number;
  latency?: number;
  range?: number;
  fieldOfView?: number;
}

export interface SensorState {
  lastUpdate: number;
  reading?: SensorReading;
  errorState?: string;
}

// =============================================================================
// Base Sensor
// =============================================================================

export abstract class Sensor {
  protected readonly config: SensorConfig;
  protected state: SensorState;

  constructor(config: SensorConfig) {
    this.config = {
      noiseLevel: 0,
      latency: 0,
      ...config,
    };
    this.state = { lastUpdate: 0 };
  }

  get id(): string {
    return this.config.id;
  }

  get type(): SensorType {
    return this.config.type;
  }

  abstract sample(
    position: Vector3,
    orientation: Quaternion,
    obstacles: AABB[],
    timestamp: number
  ): SensorReading;

  protected addNoise(value: number): number {
    if (!this.config.noiseLevel) return value;
    return value + (Math.random() - 0.5) * 2 * this.config.noiseLevel;
  }

  protected addVectorNoise(v: Vector3): Vector3 {
    if (!this.config.noiseLevel) return v;
    return {
      x: this.addNoise(v.x),
      y: this.addNoise(v.y),
      z: this.addNoise(v.z),
    };
  }
}

// =============================================================================
// LiDAR Sensor
// =============================================================================

export interface LidarConfig extends SensorConfig {
  type: 'lidar';
  horizontalResolution: number;
  verticalResolution: number;
  horizontalFOV: number;
  verticalFOV: number;
  maxRange: number;
}

export class LidarSensor extends Sensor {
  private readonly lidarConfig: LidarConfig;

  constructor(config: LidarConfig) {
    super(config);
    this.lidarConfig = config;
  }

  sample(
    position: Vector3,
    orientation: Quaternion,
    obstacles: AABB[],
    _timestamp: number
  ): SensorReading {
    const points: Vector3[] = [];
    const intensities: number[] = [];
    const ranges: number[] = [];
    const angles: number[] = [];

    const hFOV = this.lidarConfig.horizontalFOV;
    const vFOV = this.lidarConfig.verticalFOV;
    const hRes = this.lidarConfig.horizontalResolution;
    const vRes = this.lidarConfig.verticalResolution;
    const maxRange = this.lidarConfig.maxRange;

    // Generate rays
    for (let h = 0; h < hRes; h++) {
      const hAngle = -hFOV / 2 + (h / hRes) * hFOV;

      for (let v = 0; v < vRes; v++) {
        const vAngle = -vFOV / 2 + (v / vRes) * vFOV;

        // Calculate ray direction
        const direction: Vector3 = {
          x: Math.cos(vAngle) * Math.cos(hAngle),
          y: Math.sin(vAngle),
          z: Math.cos(vAngle) * Math.sin(hAngle),
        };

        // Rotate by sensor orientation
        const worldDir = Quat.rotateVector(orientation, direction);

        // Cast ray
        const hit = this.raycast(position, worldDir, maxRange, obstacles);
        const range = hit ?? maxRange;

        ranges.push(this.addNoise(range));
        angles.push(hAngle);

        if (hit) {
          const point = Vec3.add(position, Vec3.mul(worldDir, hit));
          points.push(this.addVectorNoise(point));
          intensities.push(0.8 + Math.random() * 0.2); // Mock intensity
        }
      }
    }

    const data: LidarData = { points, intensities, ranges, angles };

    return {
      sensorId: this.id,
      type: 'lidar',
      data,
      noise: this.config.noiseLevel,
      latency: this.config.latency,
    };
  }

  private raycast(
    origin: Vector3,
    direction: Vector3,
    maxDistance: number,
    obstacles: AABB[]
  ): number | null {
    let closestHit: number | null = null;

    for (const obstacle of obstacles) {
      const hit = this.raycastAABB(origin, direction, obstacle, maxDistance);
      if (hit !== null && (closestHit === null || hit < closestHit)) {
        closestHit = hit;
      }
    }

    return closestHit;
  }

  private raycastAABB(
    origin: Vector3,
    direction: Vector3,
    bounds: AABB,
    maxDistance: number
  ): number | null {
    const invDir: Vector3 = {
      x: direction.x !== 0 ? 1 / direction.x : 1e10,
      y: direction.y !== 0 ? 1 / direction.y : 1e10,
      z: direction.z !== 0 ? 1 / direction.z : 1e10,
    };

    const t1 = (bounds.min.x - origin.x) * invDir.x;
    const t2 = (bounds.max.x - origin.x) * invDir.x;
    const t3 = (bounds.min.y - origin.y) * invDir.y;
    const t4 = (bounds.max.y - origin.y) * invDir.y;
    const t5 = (bounds.min.z - origin.z) * invDir.z;
    const t6 = (bounds.max.z - origin.z) * invDir.z;

    const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
    const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));

    if (tmax < 0 || tmin > tmax || tmin > maxDistance) {
      return null;
    }

    return tmin >= 0 ? tmin : tmax;
  }
}

// =============================================================================
// IMU Sensor
// =============================================================================

export interface IMUConfig extends SensorConfig {
  type: 'imu';
  accelerometerNoise: number;
  gyroscopeNoise: number;
  driftRate: number;
}

export class IMUSensor extends Sensor {
  private readonly imuConfig: IMUConfig;
  private drift: Vector3 = { x: 0, y: 0, z: 0 };

  constructor(config: IMUConfig) {
    super(config);
    this.imuConfig = config;
  }

  sample(
    _position: Vector3,
    orientation: Quaternion,
    _obstacles: AABB[],
    timestamp: number
  ): SensorReading {
    // Simulate acceleration (gravity + movement)
    const gravity: Vector3 = { x: 0, y: -9.81, z: 0 };
    const localGravity = Quat.rotateVector(Quat.inverse(orientation), gravity);

    // Add drift over time
    const dt = (timestamp - this.state.lastUpdate) / 1000;
    this.drift = Vec3.add(this.drift, {
      x: (Math.random() - 0.5) * this.imuConfig.driftRate * dt,
      y: (Math.random() - 0.5) * this.imuConfig.driftRate * dt,
      z: (Math.random() - 0.5) * this.imuConfig.driftRate * dt,
    });

    const acceleration: Vector3 = {
      x: localGravity.x + (Math.random() - 0.5) * this.imuConfig.accelerometerNoise,
      y: localGravity.y + (Math.random() - 0.5) * this.imuConfig.accelerometerNoise,
      z: localGravity.z + (Math.random() - 0.5) * this.imuConfig.accelerometerNoise,
    };

    const angularVelocity: Vector3 = Vec3.add(this.drift, {
      x: (Math.random() - 0.5) * this.imuConfig.gyroscopeNoise,
      y: (Math.random() - 0.5) * this.imuConfig.gyroscopeNoise,
      z: (Math.random() - 0.5) * this.imuConfig.gyroscopeNoise,
    });

    const data: IMUData = {
      acceleration,
      angularVelocity,
      orientation,
    };

    this.state.lastUpdate = timestamp;

    return {
      sensorId: this.id,
      type: 'imu',
      data,
      noise: this.config.noiseLevel,
      latency: this.config.latency,
    };
  }

  resetDrift(): void {
    this.drift = { x: 0, y: 0, z: 0 };
  }
}

// =============================================================================
// GPS Sensor
// =============================================================================

export interface GPSConfig extends SensorConfig {
  type: 'gps';
  accuracy: number;
  updateInterval: number;
  originLatitude?: number;
  originLongitude?: number;
}

export class GPSSensor extends Sensor {
  private readonly gpsConfig: GPSConfig;

  constructor(config: GPSConfig) {
    super(config);
    this.gpsConfig = {
      originLatitude: 37.7749,
      originLongitude: -122.4194,
      ...config,
    };
  }

  sample(
    position: Vector3,
    _orientation: Quaternion,
    _obstacles: AABB[],
    _timestamp: number
  ): SensorReading {
    // Convert local position to GPS coordinates (simplified)
    const metersPerDegree = 111319.9;

    const latitude = this.gpsConfig.originLatitude! +
      (position.z / metersPerDegree) +
      (Math.random() - 0.5) * this.gpsConfig.accuracy / metersPerDegree;

    const longitude = this.gpsConfig.originLongitude! +
      (position.x / (metersPerDegree * Math.cos(this.gpsConfig.originLatitude! * Math.PI / 180))) +
      (Math.random() - 0.5) * this.gpsConfig.accuracy / metersPerDegree;

    const altitude = position.y +
      (Math.random() - 0.5) * this.gpsConfig.accuracy * 2;

    const data: GPSData = {
      latitude,
      longitude,
      altitude,
      accuracy: this.gpsConfig.accuracy,
    };

    return {
      sensorId: this.id,
      type: 'gps',
      data,
      noise: this.config.noiseLevel,
      latency: this.config.latency,
    };
  }
}

// =============================================================================
// Proximity Sensor
// =============================================================================

export interface ProximityConfig extends SensorConfig {
  type: 'proximity';
  maxRange: number;
  fieldOfView: number;
}

export class ProximitySensor extends Sensor {
  private readonly proximityConfig: ProximityConfig;

  constructor(config: ProximityConfig) {
    super(config);
    this.proximityConfig = config;
  }

  sample(
    position: Vector3,
    orientation: Quaternion,
    obstacles: AABB[],
    _timestamp: number
  ): SensorReading {
    const forward = Quat.rotateVector(orientation, { x: 0, y: 0, z: 1 });
    let closestDistance = this.proximityConfig.maxRange;
    let detected = false;

    for (const obstacle of obstacles) {
      // Simple distance check to obstacle center
      const obstacleCenter: Vector3 = {
        x: (obstacle.min.x + obstacle.max.x) / 2,
        y: (obstacle.min.y + obstacle.max.y) / 2,
        z: (obstacle.min.z + obstacle.max.z) / 2,
      };

      const toObstacle = Vec3.sub(obstacleCenter, position);
      const distance = Vec3.length(toObstacle);

      // Check if within FOV
      const dot = Vec3.dot(Vec3.normalize(toObstacle), forward);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

      if (angle < this.proximityConfig.fieldOfView / 2 && distance < closestDistance) {
        closestDistance = distance;
        detected = true;
      }
    }

    const data: ProximityData = {
      distance: this.addNoise(closestDistance),
      detected,
    };

    return {
      sensorId: this.id,
      type: 'proximity',
      data,
      noise: this.config.noiseLevel,
      latency: this.config.latency,
    };
  }
}

// =============================================================================
// Sensor Factory
// =============================================================================

export type AnySensorConfig = LidarConfig | IMUConfig | GPSConfig | ProximityConfig;

export function createSensor(config: AnySensorConfig): Sensor {
  switch (config.type) {
    case 'lidar':
      return new LidarSensor(config);
    case 'imu':
      return new IMUSensor(config);
    case 'gps':
      return new GPSSensor(config);
    case 'proximity':
      return new ProximitySensor(config);
    default:
      throw new Error(`Unknown sensor type: ${(config as SensorConfig).type}`);
  }
}

// =============================================================================
// Sensor Manager
// =============================================================================

export class SensorManager {
  private readonly sensors = new Map<string, Sensor>();

  addSensor(config: AnySensorConfig): Sensor {
    const sensor = createSensor(config);
    this.sensors.set(sensor.id, sensor);
    return sensor;
  }

  removeSensor(id: string): boolean {
    return this.sensors.delete(id);
  }

  getSensor(id: string): Sensor | undefined {
    return this.sensors.get(id);
  }

  getAllSensors(): Sensor[] {
    return Array.from(this.sensors.values());
  }

  sampleAll(
    position: Vector3,
    orientation: Quaternion,
    obstacles: AABB[],
    timestamp: number
  ): SensorReading[] {
    return this.getAllSensors().map(sensor =>
      sensor.sample(position, orientation, obstacles, timestamp)
    );
  }

  clear(): void {
    this.sensors.clear();
  }
}

