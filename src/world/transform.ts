/**
 * VECTRIX SDK Transform Utilities
 * @module @vectrix/sdk/world
 */

import type { Vector3, Quaternion, Transform, AABB } from '../core/types';

// =============================================================================
// Vector3 Operations
// =============================================================================

export const Vec3 = {
  zero(): Vector3 {
    return { x: 0, y: 0, z: 0 };
  },

  one(): Vector3 {
    return { x: 1, y: 1, z: 1 };
  },

  up(): Vector3 {
    return { x: 0, y: 1, z: 0 };
  },

  forward(): Vector3 {
    return { x: 0, y: 0, z: 1 };
  },

  right(): Vector3 {
    return { x: 1, y: 0, z: 0 };
  },

  create(x: number, y: number, z: number): Vector3 {
    return { x, y, z };
  },

  clone(v: Vector3): Vector3 {
    return { x: v.x, y: v.y, z: v.z };
  },

  add(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  },

  sub(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  },

  mul(v: Vector3, scalar: number): Vector3 {
    return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
  },

  div(v: Vector3, scalar: number): Vector3 {
    return { x: v.x / scalar, y: v.y / scalar, z: v.z / scalar };
  },

  dot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  },

  cross(a: Vector3, b: Vector3): Vector3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  },

  length(v: Vector3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  },

  lengthSq(v: Vector3): number {
    return v.x * v.x + v.y * v.y + v.z * v.z;
  },

  normalize(v: Vector3): Vector3 {
    const len = Vec3.length(v);
    if (len === 0) return Vec3.zero();
    return Vec3.div(v, len);
  },

  distance(a: Vector3, b: Vector3): number {
    return Vec3.length(Vec3.sub(b, a));
  },

  distanceSq(a: Vector3, b: Vector3): number {
    return Vec3.lengthSq(Vec3.sub(b, a));
  },

  lerp(a: Vector3, b: Vector3, t: number): Vector3 {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
  },

  clamp(v: Vector3, min: Vector3, max: Vector3): Vector3 {
    return {
      x: Math.max(min.x, Math.min(max.x, v.x)),
      y: Math.max(min.y, Math.min(max.y, v.y)),
      z: Math.max(min.z, Math.min(max.z, v.z)),
    };
  },

  min(a: Vector3, b: Vector3): Vector3 {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      z: Math.min(a.z, b.z),
    };
  },

  max(a: Vector3, b: Vector3): Vector3 {
    return {
      x: Math.max(a.x, b.x),
      y: Math.max(a.y, b.y),
      z: Math.max(a.z, b.z),
    };
  },

  negate(v: Vector3): Vector3 {
    return { x: -v.x, y: -v.y, z: -v.z };
  },

  reflect(v: Vector3, normal: Vector3): Vector3 {
    const d = 2 * Vec3.dot(v, normal);
    return Vec3.sub(v, Vec3.mul(normal, d));
  },

  isZero(v: Vector3, epsilon = 1e-6): boolean {
    return Math.abs(v.x) < epsilon && Math.abs(v.y) < epsilon && Math.abs(v.z) < epsilon;
  },

  equals(a: Vector3, b: Vector3, epsilon = 1e-6): boolean {
    return (
      Math.abs(a.x - b.x) < epsilon &&
      Math.abs(a.y - b.y) < epsilon &&
      Math.abs(a.z - b.z) < epsilon
    );
  },

  isNaN(v: Vector3): boolean {
    return Number.isNaN(v.x) || Number.isNaN(v.y) || Number.isNaN(v.z);
  },

  isFinite(v: Vector3): boolean {
    return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
  },
};

// =============================================================================
// Quaternion Operations
// =============================================================================

export const Quat = {
  identity(): Quaternion {
    return { x: 0, y: 0, z: 0, w: 1 };
  },

  create(x: number, y: number, z: number, w: number): Quaternion {
    return { x, y, z, w };
  },

  clone(q: Quaternion): Quaternion {
    return { x: q.x, y: q.y, z: q.z, w: q.w };
  },

  fromEuler(x: number, y: number, z: number): Quaternion {
    const cx = Math.cos(x / 2);
    const sx = Math.sin(x / 2);
    const cy = Math.cos(y / 2);
    const sy = Math.sin(y / 2);
    const cz = Math.cos(z / 2);
    const sz = Math.sin(z / 2);

    return {
      x: sx * cy * cz - cx * sy * sz,
      y: cx * sy * cz + sx * cy * sz,
      z: cx * cy * sz - sx * sy * cz,
      w: cx * cy * cz + sx * sy * sz,
    };
  },

  fromAxisAngle(axis: Vector3, angle: number): Quaternion {
    const half = angle / 2;
    const s = Math.sin(half);
    const normalized = Vec3.normalize(axis);
    return {
      x: normalized.x * s,
      y: normalized.y * s,
      z: normalized.z * s,
      w: Math.cos(half),
    };
  },

  toEuler(q: Quaternion): Vector3 {
    const sinr_cosp = 2 * (q.w * q.x + q.y * q.z);
    const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y);
    const x = Math.atan2(sinr_cosp, cosr_cosp);

    const sinp = 2 * (q.w * q.y - q.z * q.x);
    const y = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);

    const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
    const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
    const z = Math.atan2(siny_cosp, cosy_cosp);

    return { x, y, z };
  },

  multiply(a: Quaternion, b: Quaternion): Quaternion {
    return {
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    };
  },

  conjugate(q: Quaternion): Quaternion {
    return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
  },

  inverse(q: Quaternion): Quaternion {
    const lenSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
    const inv = 1 / lenSq;
    return { x: -q.x * inv, y: -q.y * inv, z: -q.z * inv, w: q.w * inv };
  },

  normalize(q: Quaternion): Quaternion {
    const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
    if (len === 0) return Quat.identity();
    return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
  },

  rotateVector(q: Quaternion, v: Vector3): Vector3 {
    const qv: Quaternion = { x: v.x, y: v.y, z: v.z, w: 0 };
    const result = Quat.multiply(Quat.multiply(q, qv), Quat.conjugate(q));
    return { x: result.x, y: result.y, z: result.z };
  },

  slerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
    let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;

    // Handle dot < 0 by negating one quaternion
    let bx = b.x, by = b.y, bz = b.z, bw = b.w;
    if (dot < 0) {
      dot = -dot;
      bx = -bx; by = -by; bz = -bz; bw = -bw;
    }

    if (dot > 0.9995) {
      // Linear interpolation for very close quaternions
      return Quat.normalize({
        x: a.x + (bx - a.x) * t,
        y: a.y + (by - a.y) * t,
        z: a.z + (bz - a.z) * t,
        w: a.w + (bw - a.w) * t,
      });
    }

    const theta = Math.acos(dot);
    const sinTheta = Math.sin(theta);
    const wa = Math.sin((1 - t) * theta) / sinTheta;
    const wb = Math.sin(t * theta) / sinTheta;

    return {
      x: a.x * wa + bx * wb,
      y: a.y * wa + by * wb,
      z: a.z * wa + bz * wb,
      w: a.w * wa + bw * wb,
    };
  },

  lookAt(forward: Vector3, up: Vector3 = Vec3.up()): Quaternion {
    const f = Vec3.normalize(forward);
    const r = Vec3.normalize(Vec3.cross(up, f));
    const u = Vec3.cross(f, r);

    const m00 = r.x, m01 = u.x, m02 = f.x;
    const m10 = r.y, m11 = u.y, m12 = f.y;
    const m20 = r.z, m21 = u.z, m22 = f.z;

    const trace = m00 + m11 + m22;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      return {
        w: 0.25 / s,
        x: (m21 - m12) * s,
        y: (m02 - m20) * s,
        z: (m10 - m01) * s,
      };
    } else if (m00 > m11 && m00 > m22) {
      const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
      return {
        w: (m21 - m12) / s,
        x: 0.25 * s,
        y: (m01 + m10) / s,
        z: (m02 + m20) / s,
      };
    } else if (m11 > m22) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
      return {
        w: (m02 - m20) / s,
        x: (m01 + m10) / s,
        y: 0.25 * s,
        z: (m12 + m21) / s,
      };
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
      return {
        w: (m10 - m01) / s,
        x: (m02 + m20) / s,
        y: (m12 + m21) / s,
        z: 0.25 * s,
      };
    }
  },
};

// =============================================================================
// Transform Operations
// =============================================================================

export const TransformOps = {
  identity(): Transform {
    return {
      position: Vec3.zero(),
      rotation: Quat.identity(),
      scale: Vec3.one(),
    };
  },

  create(position: Vector3, rotation?: Quaternion, scale?: Vector3): Transform {
    return {
      position: Vec3.clone(position),
      rotation: rotation ? Quat.clone(rotation) : Quat.identity(),
      scale: scale ? Vec3.clone(scale) : Vec3.one(),
    };
  },

  clone(t: Transform): Transform {
    return {
      position: Vec3.clone(t.position),
      rotation: Quat.clone(t.rotation),
      scale: Vec3.clone(t.scale),
    };
  },

  transformPoint(transform: Transform, point: Vector3): Vector3 {
    const scaled = {
      x: point.x * transform.scale.x,
      y: point.y * transform.scale.y,
      z: point.z * transform.scale.z,
    };
    const rotated = Quat.rotateVector(transform.rotation, scaled);
    return Vec3.add(rotated, transform.position);
  },

  transformDirection(transform: Transform, direction: Vector3): Vector3 {
    return Quat.rotateVector(transform.rotation, direction);
  },

  inverseTransformPoint(transform: Transform, point: Vector3): Vector3 {
    const translated = Vec3.sub(point, transform.position);
    const rotated = Quat.rotateVector(Quat.inverse(transform.rotation), translated);
    return {
      x: rotated.x / transform.scale.x,
      y: rotated.y / transform.scale.y,
      z: rotated.z / transform.scale.z,
    };
  },

  lerp(a: Transform, b: Transform, t: number): Transform {
    return {
      position: Vec3.lerp(a.position, b.position, t),
      rotation: Quat.slerp(a.rotation, b.rotation, t),
      scale: Vec3.lerp(a.scale, b.scale, t),
    };
  },
};

// =============================================================================
// AABB Operations
// =============================================================================

export const AABBOps = {
  create(min: Vector3, max: Vector3): AABB {
    return { min: Vec3.clone(min), max: Vec3.clone(max) };
  },

  fromCenterExtents(center: Vector3, extents: Vector3): AABB {
    return {
      min: Vec3.sub(center, extents),
      max: Vec3.add(center, extents),
    };
  },

  center(aabb: AABB): Vector3 {
    return Vec3.mul(Vec3.add(aabb.min, aabb.max), 0.5);
  },

  extents(aabb: AABB): Vector3 {
    return Vec3.mul(Vec3.sub(aabb.max, aabb.min), 0.5);
  },

  size(aabb: AABB): Vector3 {
    return Vec3.sub(aabb.max, aabb.min);
  },

  contains(aabb: AABB, point: Vector3): boolean {
    return (
      point.x >= aabb.min.x && point.x <= aabb.max.x &&
      point.y >= aabb.min.y && point.y <= aabb.max.y &&
      point.z >= aabb.min.z && point.z <= aabb.max.z
    );
  },

  intersects(a: AABB, b: AABB): boolean {
    return (
      a.min.x <= b.max.x && a.max.x >= b.min.x &&
      a.min.y <= b.max.y && a.max.y >= b.min.y &&
      a.min.z <= b.max.z && a.max.z >= b.min.z
    );
  },

  merge(a: AABB, b: AABB): AABB {
    return {
      min: Vec3.min(a.min, b.min),
      max: Vec3.max(a.max, b.max),
    };
  },

  expand(aabb: AABB, amount: number): AABB {
    const offset: Vector3 = { x: amount, y: amount, z: amount };
    return {
      min: Vec3.sub(aabb.min, offset),
      max: Vec3.add(aabb.max, offset),
    };
  },
};

