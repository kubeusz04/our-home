import { validSurface, materialNames } from "./surfaces.ts";
import { migrateEnglish } from "./migrate.ts";
import type { Apartment } from "./types.ts";
import { catalog } from "./seed.ts";
import { roomIsSimple } from "./geometry.ts";
export function parseProject(text: string): Apartment {
  return validateProject(JSON.parse(text));
}
export function validateProject(value: unknown): Apartment {
  const a = value as ReturnType<typeof JSON.parse>;
  migrateEnglish(a);
  const finite = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1000000000;
  const str = (v: unknown) => typeof v === "string" && v.length < 20000;
  const color = (v: unknown) =>
    typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
  if (
    a.schemaVersion !== 1 ||
    !str(a.id) ||
    !str(a.name) ||
    !str(a.notes) ||
    !Array.isArray(a.rooms) ||
    a.rooms.length < 1 ||
    a.rooms.length > 100 ||
    !Array.isArray(a.furniture) ||
    a.furniture.length > 2000 ||
    !Array.isArray(a.openings) ||
    !finite(a.rate) ||
    a.rate <= 0 ||
    !finite(a.budget) ||
    a.budget < 0
  )
    throw Error("Invalid project format.");
  const ids = new Set<string>();
  for (const r of a.rooms) {
    if (
      !str(r.id) ||
      ids.has(r.id) ||
      !str(r.name) ||
      !str(r.notes) ||
      !color(r.color) ||
      !Array.isArray(r.points) ||
      r.points.length < 3 ||
      r.points.length > 40 ||
      !r.points.every(
        (p: { x: number; z: number }) => finite(p.x) && finite(p.z),
      ) ||
      !roomIsSimple(r.points)
    )
      throw Error("Invalid room.");
    if (
      (r.floorSurface !== undefined && !validSurface(r.floorSurface)) ||
      (r.wallSurface !== undefined && !validSurface(r.wallSurface))
    )
      throw Error("Invalid room surface.");
    if (r.wallSurfaces !== undefined) {
      if (
        !r.wallSurfaces ||
        typeof r.wallSurfaces !== "object" ||
        Array.isArray(r.wallSurfaces) ||
        Object.entries(r.wallSurfaces).some(
          ([key, value]) =>
            !/^\d+$/.test(key) ||
            Number(key) >= r.points.length ||
            !validSurface(value),
        )
      )
        throw Error("Invalid wall surface.");
    }
    ids.add(r.id);
  }
  for (const f of a.furniture) {
    if (
      !str(f.id) ||
      ids.has(f.id) ||
      !a.rooms.some((r: { id: string }) => r.id === f.roomId) ||
      !catalog.some((c) => c.kind === f.kind) ||
      !str(f.name) ||
      !str(f.notes) ||
      !color(f.color) ||
      !materialNames.includes(f.material) ||
      !["ceramic", "glass", "slim"].includes(f.vase) ||
      typeof f.enabled !== "boolean" ||
      typeof f.purchased !== "boolean" ||
      !["x", "z", "y", "width", "depth", "height", "rotation", "cost"].every(
        (k) => finite(f[k]),
      ) ||
      f.width < 0.02 ||
      f.depth < 0.02 ||
      f.height < 0.02 ||
      f.width > 20 ||
      f.depth > 20 ||
      f.height > 20 ||
      f.y < 0 ||
      f.cost < 0
    )
      throw Error("Invalid furniture item.");
    if (f.surface !== undefined && !validSurface(f.surface))
      throw Error("Invalid item surface.");
    ids.add(f.id);
  }
  for (const o of a.openings) {
    const r = a.rooms.find((r: { id: string }) => r.id === o.roomId);
    if (
      !str(o.id) ||
      ids.has(o.id) ||
      !r ||
      !Number.isInteger(o.wallIndex) ||
      o.wallIndex < 0 ||
      o.wallIndex >= r.points.length ||
      !["door", "window", "passage"].includes(o.kind) ||
      !["offset", "width", "height", "sill"].every((k) => finite(o[k])) ||
      o.offset < 0 ||
      o.width <= 0 ||
      o.height <= 0 ||
      o.sill < 0 ||
      o.height + o.sill > 2.7
    )
      throw Error("Invalid opening.");
    if (o.surface !== undefined && !validSurface(o.surface))
      throw Error("Invalid opening surface.");
    ids.add(o.id);
  }

  return a as Apartment;
}
