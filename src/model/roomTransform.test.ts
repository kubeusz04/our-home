import { describe, it, expect } from "vitest";
import { seed } from "./seed";
import { transformRoom } from "./roomTransform";
import { bounds, fits } from "./geometry";
import { parseProject } from "./io";
import { useStore } from "./store";
describe("room size and position", () => {
  it("shrinks a furnished room and scales contents to remain inside", () => {
    const a = transformRoom(seed, "living", {
      width: 3.5,
      depth: 3,
      scaleContents: true,
    });
    const room = a.rooms.find((r) => r.id === "living")!;
    const b = bounds(room);
    expect(b.maxX - b.minX).toBeCloseTo(3.5);
    expect(b.maxZ - b.minZ).toBeCloseTo(3);
    expect(
      a.furniture
        .filter((f) => f.roomId === "living")
        .every((f) => fits(f, room)),
    ).toBe(true);
    expect(seed.rooms[0].points[1].x).toBe(4.6);
  });
  it("moves the room, all its contents and its openings atomically", () => {
    const a = transformRoom(seed, "living", { x: -2, z: 1.5 });
    expect(bounds(a.rooms[0]).minX).toBe(-2);
    for (const f of a.furniture.filter((f) => f.roomId === "living")) {
      const old = seed.furniture.find((i) => i.id === f.id)!;
      expect(f.x).toBeCloseTo(old.x - 2);
      expect(f.z).toBeCloseTo(old.z + 1.5);
      expect(f.width).toBeCloseTo(old.width);
    }
    expect(a.openings.filter((o) => o.roomId === "living")).toEqual(
      seed.openings.filter((o) => o.roomId === "living"),
    );
  });
  it("records resizing and moving as undoable project changes", () => {
    useStore.getState().load(structuredClone(seed));
    expect(useStore.getState().transformRoom("living", { width: 4 })).toBe(
      true,
    );
    useStore.getState().transformRoom("living", { x: 2 });
    useStore.getState().undo();
    expect(bounds(useStore.getState().apartment.rooms[0]).minX).toBe(0);
    expect(bounds(useStore.getState().apartment.rooms[0]).maxX).toBe(4);
    useStore.getState().undo();
    expect(bounds(useStore.getState().apartment.rooms[0]).maxX).toBe(4.6);
  });
  it("rejects invalid dimensions without changing the original project", () => {
    expect(() => transformRoom(seed, "living", { width: 0 })).toThrow();
    expect(() => transformRoom(seed, "living", { x: NaN })).toThrow();
    expect(seed.rooms[0].points[0].x).toBe(0);
  });
});
describe("English saved-project migration", () => {
  it("translates known defaults and material values, preserving custom content", () => {
    const old = structuredClone(seed);
    old.name = "Nasz projekt";
    old.rooms[0].name = "Salon";
    old.rooms[0].notes = "Custom notes";
    old.rooms[1].name = "My cooking space";
    old.furniture[1].name = "Sofa chmurka";
    Object.assign(old.furniture[1], { material: "tkanina", vase: "ceramika" });
    const a = parseProject(JSON.stringify(old));
    expect(a.name).toBe("Our project");
    expect(a.rooms[0].name).toBe("Living room");
    expect(a.rooms[1].name).toBe("My cooking space");
    expect(a.rooms[0].notes).toBe("Custom notes");
    expect(a.furniture[1].name).toBe("Cloud sofa");
    expect(a.furniture[1].material).toBe("fabric");
    expect(a.furniture[1].vase).toBe("ceramic");
    expect(a.furniture[1].x).toBe(seed.furniture[1].x);
  });
});
