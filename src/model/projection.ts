import type { Apartment, FurnitureItem } from "./types";
import { walls } from "./geometry";
export function projectionHit(f: FurnitureItem, a: Apartment) {
  const angle = (f.rotation * Math.PI) / 180,
    dir = { x: -Math.sin(angle), z: -Math.cos(angle) };
  let hit: {
    distance: number;
    x: number;
    z: number;
    angle: number;
    maxWidth: number;
  } | null = null;
  const segments = a.rooms.flatMap((r) =>
    walls(r).map((w) => ({ start: w.start, end: w.end, screen: false })),
  );
  for (const screen of a.furniture.filter(
    (i) => i.kind === "screen" && i.roomId === f.roomId,
  )) {
    const r = (screen.rotation * Math.PI) / 180;
    const side =
      (f.x - screen.x) * Math.sin(r) + (f.z - screen.z) * Math.cos(r) >= 0
        ? 1
        : -1;
    const sx = screen.x + Math.sin(r) * (screen.depth / 2 + 0.006) * side,
      sz = screen.z + Math.cos(r) * (screen.depth / 2 + 0.006) * side;
    segments.push({
      start: {
        x: sx - (Math.cos(r) * screen.width) / 2,
        z: sz + (Math.sin(r) * screen.width) / 2,
      },
      end: {
        x: sx + (Math.cos(r) * screen.width) / 2,
        z: sz - (Math.sin(r) * screen.width) / 2,
      },
      screen: true,
    });
  }
  for (const w of segments) {
    const vx = w.end.x - w.start.x,
      vz = w.end.z - w.start.z,
      det = dir.x * vz - dir.z * vx;
    if (Math.abs(det) < 0.00001) continue;
    const px = w.start.x - f.x,
      pz = w.start.z - f.z,
      t = (px * vz - pz * vx) / det,
      u = (px * dir.z - pz * dir.x) / det;
    if (t > 0.1 && u >= 0 && u <= 1 && (!hit || t < hit.distance)) {
      const len = Math.hypot(vx, vz);
      hit = {
        distance: t,
        x: f.x + dir.x * t,
        z: f.z + dir.z * t,
        angle: -Math.atan2(vz, vx),
        maxWidth: Math.max(0.1, 2 * Math.min(u, 1 - u) * len),
      };
    }
  }
  return hit;
}
