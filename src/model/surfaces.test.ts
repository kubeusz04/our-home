import { describe, it, expect, beforeEach } from "vitest";
import { seed } from "./seed";
import { useStore } from "./store";
import {
  defaultSurface,
  floorSurface,
  itemSurface,
  validSurface,
  wallSurface,
} from "./surfaces";
import { parseProject } from "./io";
import { wallSegments } from "./geometry";
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ9sAAAAASUVORK5CYII=";
beforeEach(() => useStore.getState().load(structuredClone(seed)));
describe("surface validation and backwards compatibility", () => {
  it("keeps projects without surface fields usable", () => {
    const a = parseProject(JSON.stringify(seed));
    expect(floorSurface(a.rooms[0]).material).toBe("wood");
    expect(wallSurface(a.rooms[0]).material).toBe("plaster");
    expect(itemSurface(a.furniture[1]).color).toBe(a.furniture[1].color);
  });
  it("accepts embedded raster images but rejects remote URLs, SVG and invalid settings", () => {
    const s = {
      ...defaultSurface(),
      texture: "custom" as const,
      image: png,
      imageName: "sample.png",
    };
    expect(validSurface(s)).toBe(true);
    expect(validSurface({ ...s, image: "https://example.com/image.png" })).toBe(
      false,
    );
    expect(
      validSurface({ ...s, image: "data:image/svg+xml;base64,PHN2Zz4=" }),
    ).toBe(false);
    expect(validSurface({ ...s, repeat: 0 })).toBe(false);
    expect(validSurface({ ...s, rotation: Infinity })).toBe(false);
    expect(validSurface({ ...s, roughness: 1.5 })).toBe(false);
  });
  it("rejects invalid room and item finishes during JSON import", () => {
    const a = structuredClone(seed);
    a.rooms[0].wallSurface = {
      ...defaultSurface(),
      texture: "custom",
      image: "https://invalid.test/a.png",
    };
    expect(() => parseProject(JSON.stringify(a))).toThrow("surface");
    delete a.rooms[0].wallSurface;
    a.furniture[0].surface = { ...defaultSurface(), repeat: -2 };
    expect(() => parseProject(JSON.stringify(a))).toThrow("surface");
  });
});
describe("editable and saved finishes", () => {
  it("synchronises item colour and material without changing other objects", () => {
    const s = useStore.getState(),
      finish = {
        ...defaultSurface("#a4b79a", "fabric"),
        texture: "linen" as const,
        repeat: 3,
        rotation: 45,
      };
    expect(s.updateItem("seed-2", { surface: finish })).toBe(true);
    const a = useStore.getState().apartment;
    expect(a.furniture[1].color).toBe("#a4b79a");
    expect(a.furniture[1].surface?.repeat).toBe(3);
    expect(a.furniture[2]).toEqual(seed.furniture[2]);
    s.undo();
    expect(useStore.getState().apartment.furniture[1].surface).toBeUndefined();
    s.redo();
    expect(useStore.getState().apartment.furniture[1].surface).toEqual(finish);
  });
  it("supports inherited wall styles, individual overrides and applying all walls", () => {
    const s = useStore.getState(),
      all = {
        ...defaultSurface("#e6d8c4", "plaster"),
        texture: "concrete" as const,
      },
      one = { ...all, color: "#76906d", texture: "brick" as const };
    s.updateRoomSurface("living", "walls", all);
    s.updateRoomSurface("living", 1, one);
    let r = useStore.getState().apartment.rooms[0];
    expect(wallSurface(r, 0)).toEqual(all);
    expect(wallSurface(r, 1)).toEqual(one);
    expect(useStore.getState().apartment.rooms[1]).toEqual(seed.rooms[1]);
    s.updateRoomSurface("living", "walls", all);
    r = useStore.getState().apartment.rooms[0];
    expect(r.wallSurfaces).toEqual({});
    expect(wallSurface(r, 1)).toEqual(all);
    s.undo();
    expect(wallSurface(useStore.getState().apartment.rooms[0], 1)).toEqual(one);
  });
  it("updates floor colour and preserves image, repeat and rotation in exported JSON", () => {
    const s = useStore.getState(),
      style = {
        ...defaultSurface("#f3eee3", "stone"),
        texture: "custom" as const,
        image: png,
        imageName: "marble.png",
        repeat: 2,
        rotation: 30,
      };
    s.updateRoomSurface("living", "floor", style);
    const a = parseProject(JSON.stringify(useStore.getState().apartment));
    expect(a.rooms[0].color).toBe(style.color);
    expect(floorSurface(a.rooms[0])).toEqual(style);
  });
  it("preserves both room-facing owners of shared walls", () => {
    const segment = wallSegments(seed).find(
      (s) =>
        s.sides.some((o) => o.room.id === "living") &&
        s.sides.some((o) => o.room.id === "kitchen"),
    );
    expect(segment).toBeTruthy();
    expect(segment!.sides).toHaveLength(2);
    expect(new Set(segment!.sides.map((s) => s.positive)).size).toBe(2);
  });
});
