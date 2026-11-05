import { describe, it, expect } from "vitest";
import { seed } from "./seed";
import { area, contains, overlap, canPlace, roomIsSimple } from "./geometry";
import { parseProject } from "./io";
import { useStore } from "./store";
describe("model przestrzenny", () => {
  it("ma siedem pokoi i poprawny JSON", () => {
    expect(seed.rooms).toHaveLength(7);
    expect(parseProject(JSON.stringify(seed))).toEqual(seed);
    expect(area(seed.rooms[0])).toBeCloseTo(19.32);
  });
  it("odrzuca uszkodzone dane bez mutacji", () => {
    expect(() => parseProject('{"schemaVersion":2}')).toThrow();
    const a = structuredClone(seed);
    a.furniture[0].width = -1;
    expect(() => parseProject(JSON.stringify(a))).toThrow();
  });
  it("rozpoznaje obrys, samoprzecięcia i granice", () => {
    expect(contains({ x: 2, z: 2 }, seed.rooms[0])).toBe(true);
    expect(contains({ x: 12, z: 2 }, seed.rooms[0])).toBe(false);
    expect(
      roomIsSimple([
        { x: 0, z: 0 },
        { x: 2, z: 2 },
        { x: 0, z: 2 },
        { x: 2, z: 0 },
      ]),
    ).toBe(false);
    expect(canPlace({ ...seed.furniture[1], x: -5 }, seed, false)).toBeTruthy();
  });
  it("kolizje uwzględniają wysokość i obrót", () => {
    const a = seed.furniture[1];
    expect(overlap(a, { ...a, id: "other" })).toBe(true);
    expect(overlap(a, { ...a, x: 15, rotation: 45 })).toBe(false);
    expect(overlap(a, { ...a, y: 2 })).toBe(false);
  });
});
describe("historia", () => {
  it("zmiana materiału, undo i redo", () => {
    const s = useStore.getState();
    s.updateItem("seed-2", { color: "#ffcc00", material: "matte" });
    expect(useStore.getState().apartment.furniture[1].color).toBe("#ffcc00");
    s.undo();
    expect(useStore.getState().apartment.furniture[1].color).toBe(
      seed.furniture[1].color,
    );
    s.redo();
    expect(useStore.getState().apartment.furniture[1].material).toBe("matte");
  });
});
