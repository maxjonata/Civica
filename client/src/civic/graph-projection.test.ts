import { describe, expect, it } from "vitest";
import { projectGraphPoint } from "./graph-projection";

describe("3D graph projection", () => {
  it("uses depth and the Z coordinate in its perspective projection", () => {
    const front = projectGraphPoint({ x: 0, y: 0, z: 1 }, 0);
    const back = projectGraphPoint({ x: 0, y: 0, z: -1 }, 0);
    expect(front.depth).not.toBe(back.depth);
    expect(front.y).not.toBe(back.y);
  });

  it("changes the projected view when the user changes yaw", () => {
    const point = { x: 1, y: 0.2, z: 0.3 };
    const initial = projectGraphPoint(point, 0);
    const rotated = projectGraphPoint(point, 90);
    expect(rotated.x).not.toBeCloseTo(initial.x, 2);
    expect(Number.isFinite(rotated.y)).toBe(true);
  });

  it("keeps the origin centered and all results finite", () => {
    const center = projectGraphPoint({ x: 0, y: 0, z: 0 }, 32);
    expect(center.x).toBeCloseTo(310, 2);
    expect(center.y).toBeCloseTo(180, 2);
    expect(Number.isFinite(center.depth)).toBe(true);
  });
});
