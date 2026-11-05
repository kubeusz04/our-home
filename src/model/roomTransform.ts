import type { Apartment, FurnitureItem, Room } from "./types";
import { bounds, fits, footprint, roomIsSimple } from "./geometry";
export interface RoomTransform {
  x?: number;
  z?: number;
  width?: number;
  depth?: number;
  scaleContents?: boolean;
}
/** One atomic edit keeps room geometry, furniture and openings in the same coordinates. */
export function transformRoom(
  a: Apartment,
  id: string,
  patch: RoomTransform,
): Apartment {
  const room = a.rooms.find((r) => r.id === id);
  if (!room) throw Error("Room not found.");
  const old = bounds(room),
    oldWidth = old.maxX - old.minX,
    oldDepth = old.maxZ - old.minZ;
  const x = patch.x ?? old.minX,
    z = patch.z ?? old.minZ,
    width = patch.width ?? oldWidth,
    depth = patch.depth ?? oldDepth;
  if (
    ![x, z, width, depth].every(Number.isFinite) ||
    width < 1 ||
    depth < 1 ||
    width > 20 ||
    depth > 20
  )
    throw Error("Room dimensions must be between 1 and 20 metres.");
  const sx = width / oldWidth,
    sz = depth / oldDepth;
  const next: Room = {
    ...room,
    points: room.points.map((p) => ({
      x: x + (p.x - old.minX) * sx,
      z: z + (p.z - old.minZ) * sz,
    })),
  };
  if (!roomIsSimple(next.points))
    throw Error(
      "This position or outline is outside the supported project area.",
    );
  const result = structuredClone(a);
  result.rooms = result.rooms.map((r) => (r.id === id ? next : r));
  result.furniture = result.furniture.map((f) => {
    if (f.roomId !== id) return f;
    const angle = (f.rotation * Math.PI) / 180;
    let item: FurnitureItem = {
      ...f,
      x: x + (f.x - old.minX) * sx,
      z: z + (f.z - old.minZ) * sz,
    };
    if (patch.scaleContents !== false) {
      item.width *= Math.hypot(Math.cos(angle) * sx, Math.sin(angle) * sz);
      item.depth *= Math.hypot(Math.sin(angle) * sx, Math.cos(angle) * sz);
    }
    const ps = footprint({ ...item, x: 0, z: 0 }),
      halfX = Math.max(...ps.map((p) => Math.abs(p.x))),
      halfZ = Math.max(...ps.map((p) => Math.abs(p.z)));
    if (halfX * 2 >= width || halfZ * 2 >= depth)
      throw Error(
        `“${f.name}” is too large for this room. Enable Scale furniture with room or use a larger room.`,
      );
    item = {
      ...item,
      x: Math.max(
        x + halfX + 0.001,
        Math.min(x + width - halfX - 0.001, item.x),
      ),
      z: Math.max(
        z + halfZ + 0.001,
        Math.min(z + depth - halfZ - 0.001, item.z),
      ),
    };
    if (!fits(item, next))
      throw Error(
        `“${f.name}” would fall outside the room. Adjust its outline or furniture first.`,
      );
    return item;
  });
  result.openings = result.openings.map((o) => {
    if (o.roomId !== id) return o;
    const start = room.points[o.wallIndex],
      end = room.points[(o.wallIndex + 1) % room.points.length],
      p = next.points[o.wallIndex],
      q = next.points[(o.wallIndex + 1) % next.points.length];
    const oldLength = Math.hypot(end.x - start.x, end.z - start.z),
      length = Math.hypot(q.x - p.x, q.z - p.z),
      ratio = length / oldLength,
      openingWidth = Math.min(
        o.width * (patch.scaleContents === false ? 1 : ratio),
        length,
      );
    return {
      ...o,
      width: openingWidth,
      offset: Math.max(0, Math.min(o.offset * ratio, length - openingWidth)),
    };
  });
  return result;
}
