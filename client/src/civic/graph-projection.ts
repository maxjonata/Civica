export interface GraphPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface GraphPoint2D {
  x: number;
  y: number;
  depth: number;
}

export function projectGraphPoint(
  point: GraphPoint3D,
  yawDegrees: number,
  pitchDegrees = 20,
  width = 620,
  height = 360
): GraphPoint2D {
  const yaw = (yawDegrees * Math.PI) / 180;
  const pitch = (pitchDegrees * Math.PI) / 180;
  const yawX = point.x * Math.cos(yaw) - point.z * Math.sin(yaw);
  const yawZ = point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
  const pitchedY = point.y * Math.cos(pitch) - yawZ * Math.sin(pitch);
  const depth = point.y * Math.sin(pitch) + yawZ * Math.cos(pitch);
  const perspective = 2.5 / (2.8 - depth * 0.45);
  const scale = Math.min(width * 0.42, height * 0.38);

  return {
    x: width / 2 + yawX * scale * perspective,
    y: height / 2 - pitchedY * scale * perspective,
    depth,
  };
}
