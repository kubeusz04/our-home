import type { Apartment, FurnitureItem, Room, Vec2, Wall } from "./types.ts";
export const snapValue = (n: number, snap: boolean) =>
  snap ? Math.round(n * 10) / 10 : n;
export function area(room: Room) {
  return (
    Math.abs(
      room.points.reduce((s, p, i) => {
        const q = room.points[(i + 1) % room.points.length];
        return s + p.x * q.z - q.x * p.z;
      }, 0),
    ) / 2
  );
}
export function bounds(room: Room) {
  const xs = room.points.map((p) => p.x),
    zs = room.points.map((p) => p.z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}
export function walls(room: Room): Wall[] {
  return room.points.map((p, i) => ({
    id: `${room.id}-wall-${i}`,
    start: p,
    end: room.points[(i + 1) % room.points.length],
    height: 2.7,
    thickness: 0.12,
  }));
}
export function contains(point: Vec2, room: Room) {
  let inside = false;
  const ps = room.points;
  for (let i = 0, j = ps.length - 1; i < ps.length; j = i++) {
    const a = ps[i],
      b = ps[j];
    if (
      a.z > point.z !== b.z > point.z &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
    )
      inside = !inside;
  }
  return inside;
}
export function footprint(f: FurnitureItem): Vec2[] {
  const r = (f.rotation * Math.PI) / 180;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, z]) => ({
    x:
      f.x +
      ((x * f.width) / 2) * Math.cos(r) -
      ((z * f.depth) / 2) * Math.sin(r),
    z:
      f.z +
      ((x * f.width) / 2) * Math.sin(r) +
      ((z * f.depth) / 2) * Math.cos(r),
  }));
}
export function fits(f: FurnitureItem, r: Room) {
  return footprint(f).every((p) => contains(p, r));
}
export function overlap(a: FurnitureItem, b: FurnitureItem) {
  if (a.y + a.height <= b.y + 0.025 || b.y + b.height <= a.y + 0.025)
    return false;
  const ap = footprint(a),
    bp = footprint(b);
  for (const ps of [ap, bp])
    for (let i = 0; i < 4; i++) {
      const p = ps[i],
        q = ps[(i + 1) % 4],
        axis = { x: -(q.z - p.z), z: q.x - p.x };
      const aa = ap.map((p) => p.x * axis.x + p.z * axis.z),
        bb = bp.map((p) => p.x * axis.x + p.z * axis.z);
      if (
        Math.max(...aa) <= Math.min(...bb) + 0.01 ||
        Math.max(...bb) <= Math.min(...aa) + 0.01
      )
        return false;
    }
  return true;
}
export function canPlace(f: FurnitureItem, a: Apartment, collisions: boolean) {
  const room = a.rooms.find((r) => r.id === f.roomId);
  if (!room || !fits(f, room)) return "The item must fit inside its room.";
  if (
    collisions &&
    f.kind !== "rug" &&
    a.furniture.some(
      (b) =>
        b.id !== f.id &&
        b.roomId === f.roomId &&
        b.kind !== "rug" &&
        overlap(f, b),
    )
  )
    return "Another item occupies this space.";
  return null;
}
export function roomIsSimple(points: Vec2[]) {
  if (
    points.length < 3 ||
    points.some(
      (p, i) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.z) ||
        Math.abs(p.x) > 500 ||
        Math.abs(p.z) > 500 ||
        Math.hypot(
          p.x - points[(i + 1) % points.length].x,
          p.z - points[(i + 1) % points.length].z,
        ) < 0.3,
    )
  )
    return false;
  const box = bounds({ points } as Room);
  if (box.maxX - box.minX > 20 || box.maxZ - box.minZ > 20) return false;
  const cross = (a: Vec2, b: Vec2, c: Vec2) =>
    (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      const a = points[i],
        b = points[(i + 1) % points.length],
        c = points[j],
        d = points[(j + 1) % points.length];
      if (
        cross(a, b, c) * cross(a, b, d) <= 0 &&
        cross(c, d, a) * cross(c, d, b) <= 0
      )
        return false;
    }
  return area({ points } as Room) > 0.3;
}

/** Split shared, partly overlapping walls once; openings cut both adjoining rooms. */
export function wallSegments(a: Apartment) {
  const sources = a.rooms.flatMap((room) =>
    walls(room).map((wall, index) => ({
      room,
      wall,
      wallIndex: index,
      openings: a.openings.filter(
        (o) => o.roomId === room.id && o.wallIndex === index,
      ),
    })),
  );
  const result: {
      wall: Wall;
      room: Room;
      openings: import("./types").Opening[];
      exterior: boolean;
      sides: { room: Room; wallIndex: number; positive: boolean }[];
    }[] = [],
    seen = new Set<string>();
  for (const src of sources) {
    const w = src.wall,
      dx = w.end.x - w.start.x,
      dz = w.end.z - w.start.z,
      len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const ux = dx / len,
      uz = dz / len;
    const along = (p: Vec2) => (p.x - w.start.x) * ux + (p.z - w.start.z) * uz;
    const aligned = sources.filter(
      (t) =>
        Math.abs(
          (t.wall.start.x - w.start.x) * uz - (t.wall.start.z - w.start.z) * ux,
        ) < 0.001 &&
        Math.abs(
          (t.wall.end.x - w.start.x) * uz - (t.wall.end.z - w.start.z) * ux,
        ) < 0.001,
    );
    const cuts = [0, len];
    for (const t of aligned) {
      cuts.push(along(t.wall.start), along(t.wall.end));
      const l = Math.hypot(
          t.wall.end.x - t.wall.start.x,
          t.wall.end.z - t.wall.start.z,
        ),
        dot =
          ((t.wall.end.x - t.wall.start.x) * ux +
            (t.wall.end.z - t.wall.start.z) * uz) /
          l;
      for (const o of t.openings) {
        cuts.push(
          along(t.wall.start) + dot * o.offset,
          along(t.wall.start) + dot * (o.offset + o.width),
        );
      }
    }
    const sorted = [
      ...new Set(
        cuts
          .filter((v) => v >= 0 && v <= len)
          .map((v) => Math.round(v * 10000) / 10000),
      ),
    ].sort((x, y) => x - y);
    for (let i = 0; i < sorted.length - 1; i++) {
      const lo = sorted[i],
        hi = sorted[i + 1];
      if (hi - lo < 0.005) continue;
      const start = { x: w.start.x + ux * lo, z: w.start.z + uz * lo },
        end = { x: w.start.x + ux * hi, z: w.start.z + uz * hi },
        coords = [
          `${start.x.toFixed(3)},${start.z.toFixed(3)}`,
          `${end.x.toFixed(3)},${end.z.toFixed(3)}`,
        ].sort(),
        key = coords.join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      const midpoint = (lo + hi) / 2;
      const owners = aligned.filter(
        (t) =>
          midpoint > Math.min(along(t.wall.start), along(t.wall.end)) - 0.001 &&
          midpoint < Math.max(along(t.wall.start), along(t.wall.end)) + 0.001,
      );
      let opening: import("./types").Opening | undefined;
      for (const t of owners) {
        const l = Math.hypot(
            t.wall.end.x - t.wall.start.x,
            t.wall.end.z - t.wall.start.z,
          ),
          dot =
            ((t.wall.end.x - t.wall.start.x) * ux +
              (t.wall.end.z - t.wall.start.z) * uz) /
            l;
        opening = t.openings.find((o) => {
          const x = along(t.wall.start) + dot * o.offset,
            y = along(t.wall.start) + dot * (o.offset + o.width);
          return (
            midpoint >= Math.min(x, y) - 0.001 &&
            midpoint <= Math.max(x, y) + 0.001
          );
        });
        if (opening) break;
      }
      result.push({
        wall: { ...w, id: key, start, end },
        room: src.room,
        exterior: owners.length === 1,
        sides: owners.map((owner) => ({
          room: owner.room,
          wallIndex: owner.wallIndex,
          positive: contains(
            {
              x: (start.x + end.x) / 2 - uz * 0.04,
              z: (start.z + end.z) / 2 + ux * 0.04,
            },
            owner.room,
          ),
        })),
        openings: opening
          ? [{ ...opening, id: opening.id + key, offset: 0, width: hi - lo }]
          : [],
      });
    }
  }
  return result;
}

export function walkable(point: Vec2, a: Apartment, collisions = true) {
  if (!a.rooms.some((r) => contains(point, r))) return false;
  for (const seg of wallSegments(a)) {
    if (seg.openings.some((o) => o.sill === 0 && o.height >= 1.8)) continue;
    const w = seg.wall,
      dx = w.end.x - w.start.x,
      dz = w.end.z - w.start.z,
      den = dx * dx + dz * dz;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - w.start.x) * dx + (point.z - w.start.z) * dz) / den,
      ),
    );
    if (
      Math.hypot(point.x - w.start.x - t * dx, point.z - w.start.z - t * dz) <
      0.15
    )
      return false;
  }
  return (
    !collisions ||
    !a.furniture.some(
      (f) =>
        f.kind !== "rug" &&
        f.y < 1.8 &&
        f.y + f.height > 0.3 &&
        contains(point, {
          points: footprint({
            ...f,
            width: f.width + 0.25,
            depth: f.depth + 0.25,
          }),
        } as Room),
    )
  );
}
