import { collaborationBridge } from "../collab/bridge";
import { randomId } from "./id";
import { validSurface } from "./surfaces";
import type { SurfaceStyle } from "./types";
import {
  transformRoom as applyRoomTransform,
  type RoomTransform,
} from "./roomTransform";
import { migrateEnglish } from "./migrate";
import { create } from "zustand";
import { seed, catalog } from "./seed";
import type { Apartment, FurnitureItem, FurnitureKind, Room } from "./types";
import { bounds, canPlace, roomIsSimple, fits } from "./geometry";
const clone = <T>(a: T): T => structuredClone(a);
function selectionFor(
  a: Apartment,
  s: { roomId: string; selectedId: string | null },
) {
  return {
    roomId: a.rooms.some((r) => r.id === s.roomId) ? s.roomId : a.rooms[0].id,
    selectedId:
      a.furniture.some((f) => f.id === s.selectedId) ||
      a.openings.some((o) => o.id === s.selectedId)
        ? s.selectedId
        : null,
  };
}
interface State {
  apartment: Apartment;
  selectedId: string | null;
  selectedWall: { roomId: string; index: number } | null;
  roomId: string;
  roomInspectorTab: "layout" | "surfaces";
  view: "2d" | "3d" | "walk";
  tab: string;
  tool:
    | "select"
    | "room-move"
    | "move"
    | "rotate"
    | "scale"
    | "corners"
    | "door"
    | "window"
    | "passage";
  snap: boolean;
  grid: boolean;
  dimensions: boolean;
  showWalls: boolean;
  furnitureVisible: boolean;
  collisions: boolean;
  evening: boolean;
  past: Apartment[];
  future: Apartment[];
  message: string;
  hydrated: boolean;
  saveStatus: string;
  change: (fn: (a: Apartment) => void) => boolean;
  select: (id: string | null) => void;
  updateItem: (
    id: string,
    patch: Partial<FurnitureItem>,
    record?: boolean,
  ) => boolean;
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  addItem: (kind: FurnitureKind) => void;
  removeItem: (id: string) => void;
  duplicate: (id: string) => void;
  updateRoom: (id: string, patch: Partial<Room>, record?: boolean) => boolean;
  transformRoom: (
    id: string,
    patch: RoomTransform,
    record?: boolean,
  ) => boolean;
  addRoom: (name: string, width: number, depth: number) => void;
  deleteRoom: (id: string) => void;
  load: (a: Apartment) => void;
  notify: (s: string) => void;
  selectWall: (roomId: string, index: number) => void;
  updateRoomSurface: (
    id: string,
    target: "floor" | "walls" | number,
    surface: SurfaceStyle,
  ) => boolean;
}
export const useStore = create<State>((set, get) => ({
  apartment: clone(seed),
  selectedId: "seed-2",
  selectedWall: null,
  roomId: "living",
  roomInspectorTab: "layout",
  view: "3d",
  tab: "Project",
  tool: "select",
  snap: true,
  grid: false,
  dimensions: true,
  showWalls: true,
  furnitureVisible: true,
  collisions: true,
  evening: false,
  past: [],
  future: [],
  message: "",
  hydrated: false,
  saveStatus: "Loading…",
  notify: (message) => set({ message }),
  select: (selectedId) => set({ selectedId, selectedWall: null }),
  selectWall: (roomId, index) =>
    set({
      roomId,
      selectedWall: { roomId, index },
      selectedId: null,
      roomInspectorTab: "surfaces",
    }),
  updateRoomSurface: (id, target, surface) => {
    if (!validSurface(surface)) {
      set({ message: "Invalid surface settings." });
      return false;
    }
    const room = get().apartment.rooms.find((r) => r.id === id);
    if (
      !room ||
      (typeof target === "number" &&
        (!Number.isInteger(target) ||
          target < 0 ||
          target >= room.points.length))
    )
      return false;
    get().change((a) => {
      const r = a.rooms.find((r) => r.id === id)!;
      if (target === "floor") {
        r.floorSurface = surface;
        r.color = surface.color;
      } else if (target === "walls") {
        r.wallSurface = surface;
        r.wallSurfaces = {};
      } else r.wallSurfaces = { ...r.wallSurfaces, [target]: surface };
    });
    return true;
  },
  change: (fn) => {
    const s = get(),
      a = clone(s.apartment);
    fn(a);
    if (collaborationBridge.guard && !collaborationBridge.guard(s.apartment, a))
      return false;
    set({
      apartment: a,
      past: [...s.past, s.apartment].slice(-60),
      future: [],
    });
    return true;
  },
  checkpoint: () =>
    set((s) => ({ past: [...s.past, s.apartment].slice(-60), future: [] })),
  updateItem: (id, patch, record = true) => {
    const s = get(),
      old = s.apartment.furniture.find((f) => f.id === id);
    if (!old) return false;
    const next = { ...old, ...patch };
    if (patch.surface) {
      if (!validSurface(patch.surface)) {
        set({ message: "Invalid surface settings." });
        return false;
      }
      next.color = patch.surface.color;
      next.material = patch.surface.material;
    }
    if (next.surface)
      next.surface = {
        ...next.surface,
        color: next.color,
        material: next.material,
      };
    if (
      ![next.width, next.depth, next.height].every(
        (n) => Number.isFinite(n) && n >= 0.02 && n <= 20,
      ) ||
      ![next.x, next.z, next.y, next.rotation, next.cost].every(
        Number.isFinite,
      ) ||
      next.cost < 0 ||
      next.y < 0
    ) {
      set({ message: "Enter valid dimensions and a non-negative cost." });
      return false;
    }
    if (
      ["x", "z", "width", "depth", "rotation", "roomId", "y", "height"].some(
        (k) => k in patch,
      )
    ) {
      const error = canPlace(next, s.apartment, s.collisions);
      if (error) {
        set({ message: error });
        return false;
      }
    }
    const a = clone(s.apartment);
    a.furniture = a.furniture.map((f) => (f.id === id ? next : f));
    if (collaborationBridge.guard && !collaborationBridge.guard(s.apartment, a))
      return false;
    set({
      apartment: a,
      ...(record
        ? { past: [...s.past, s.apartment].slice(-60), future: [] }
        : {}),
    });
    return true;
  },
  undo: () => {
    if (collaborationBridge.undo) {
      collaborationBridge.undo();
      return;
    }
    const s = get();
    if (s.past.length)
      set({
        apartment: s.past[s.past.length - 1],
        ...selectionFor(s.past[s.past.length - 1], s),
        past: s.past.slice(0, -1),
        future: [s.apartment, ...s.future],
      });
  },
  redo: () => {
    if (collaborationBridge.redo) {
      collaborationBridge.redo();
      return;
    }
    const s = get();
    if (s.future.length)
      set({
        apartment: s.future[0],
        ...selectionFor(s.future[0], s),
        past: [...s.past, s.apartment],
        future: s.future.slice(1),
      });
  },
  addItem: (kind) => {
    const s = get(),
      c = catalog.find((c) => c.kind === kind)!,
      r = s.apartment.rooms.find((r) => r.id === s.roomId)!;
    const b = bounds(r);
    let f: FurnitureItem = {
      ...c,
      id: randomId(),
      roomId: r.id,
      x: (b.minX + b.maxX) / 2,
      z: (b.minZ + b.maxZ) / 2,
      y: 0,
      rotation: 0,
      cost: 0,
      notes: "",
      purchased: false,
      vase: "ceramic",
      enabled: true,
    };
    let found = false;
    for (let z = b.minZ + c.depth / 2 + 0.05; z < b.maxZ && !found; z += 0.2)
      for (let x = b.minX + c.width / 2 + 0.05; x < b.maxX; x += 0.2) {
        const n = { ...f, x, z };
        if (!canPlace(n, s.apartment, s.collisions)) {
          f = n;
          found = true;
          break;
        }
      }
    if (!found) {
      set({
        message:
          "No free space. Choose another room or turn off collision detection.",
      });
      return;
    }
    if (
      !s.change((a) => {
        a.furniture.push(f);
      })
    )
      return;
    set({
      selectedId: f.id,
      furnitureVisible: true,
      message: `Added: ${c.name}`,
    });
  },
  removeItem: (id) => {
    get().change((a) => {
      a.furniture = a.furniture.filter((f) => f.id !== id);
    });
    set({ selectedId: null });
  },
  duplicate: (id) => {
    const s = get(),
      f = s.apartment.furniture.find((f) => f.id === id);
    if (!f) return;
    const b = bounds(s.apartment.rooms.find((r) => r.id === f.roomId)!);
    for (let z = b.minZ + 0.1; z < b.maxZ; z += 0.2)
      for (let x = b.minX + 0.1; x < b.maxX; x += 0.2) {
        const n = { ...f, id: randomId(), x, z };
        if (!canPlace(n, s.apartment, s.collisions)) {
          if (!s.change((a) => a.furniture.push(n))) return;
          set({ selectedId: n.id });
          return;
        }
      }
    set({ message: "There is no room for a duplicate." });
  },
  updateRoom: (id, patch, record = true) => {
    const s = get(),
      r = s.apartment.rooms.find((r) => r.id === id);
    if (!r) return false;
    const n = { ...r, ...patch };
    if (!n.name.trim() || !roomIsSimple(n.points)) {
      set({ message: "The room needs a valid outline and a name." });
      return false;
    }
    if (
      patch.points &&
      s.apartment.furniture.some((f) => f.roomId === id && !fits(f, n))
    ) {
      set({
        message: "Move the furniture first so it fits inside the new outline.",
      });
      return false;
    }
    const a = clone(s.apartment);
    a.rooms = a.rooms.map((r) => (r.id === id ? n : r));
    a.openings = a.openings.map((o) => {
      if (o.roomId !== id) return o;
      const p = n.points[o.wallIndex],
        q = n.points[(o.wallIndex + 1) % n.points.length],
        len = Math.hypot(q.x - p.x, q.z - p.z);
      return {
        ...o,
        width: Math.min(o.width, len),
        offset: Math.min(o.offset, Math.max(0, len - o.width)),
      };
    });
    set({
      apartment: a,
      ...(record
        ? { past: [...s.past, s.apartment].slice(-60), future: [] }
        : {}),
    });
    return true;
  },
  transformRoom: (id, patch, record = true) => {
    const s = get();
    try {
      const apartment = applyRoomTransform(s.apartment, id, patch);
      if (
        collaborationBridge.guard &&
        !collaborationBridge.guard(s.apartment, apartment)
      )
        return false;
      set({
        apartment,
        roomId: id,
        selectedId: null,
        ...(record
          ? { past: [...s.past, s.apartment].slice(-60), future: [] }
          : {}),
      });
      return true;
    } catch (error) {
      set({
        message:
          error instanceof Error
            ? error.message
            : "Could not update this room.",
      });
      return false;
    }
  },
  addRoom: (name, width, depth) => {
    if (!name.trim() || width < 1 || depth < 1 || width > 20 || depth > 20)
      return;
    const s = get(),
      x =
        Math.max(
          ...s.apartment.rooms.flatMap((r) => r.points.map((p) => p.x)),
        ) + 0.3;
    const r: Room = {
      id: randomId(),
      name,
      points: [
        { x, z: 0 },
        { x: x + width, z: 0 },
        { x: x + width, z: depth },
        { x, z: depth },
      ],
      color: "#dfd1b7",
      notes: "",
    };
    if (!s.change((a) => a.rooms.push(r))) return;
    set({ roomId: r.id, selectedId: null, view: "2d" });
  },
  deleteRoom: (id) => {
    const s = get();
    if (s.apartment.rooms.length <= 1) {
      set({ message: "Keep at least one room." });
      return;
    }
    if (
      !s.change((a) => {
        a.rooms = a.rooms.filter((r) => r.id !== id);
        a.furniture = a.furniture.filter((f) => f.roomId !== id);
        a.openings = a.openings.filter((o) => o.roomId !== id);
      })
    )
      return;
    set({ roomId: get().apartment.rooms[0].id, selectedId: null });
  },
  load: (a) => {
    a = migrateEnglish(clone(a));
    if (!get().change((d) => Object.assign(d, a))) return;
    set({
      roomId: a.rooms[0].id,
      selectedId: null,
      message: "Project imported.",
    });
  },
}));
