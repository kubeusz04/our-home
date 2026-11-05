import { describe, it, expect } from "vitest";
import { seed } from "./seed";
import { wallSegments, walkable } from "./geometry";
import { projectionHit } from "./projection";
import { useStore } from "./store";
describe("ściany i spacer", () => {
  it("nie dubluje ścian i przenosi wycięcia na stronę sąsiada", () => {
    const segs = wallSegments(seed);
    expect(new Set(segs.map((s) => s.wall.id)).size).toBe(segs.length);
    const door = segs.find((s) =>
      s.openings.some((o) => o.id.startsWith("o3")),
    );
    expect(door).toBeTruthy();
    expect(door?.exterior).toBe(false);
    expect(door?.wall.start.z).toBeCloseTo(4.2);
  });
  it("pozwala przejść przez otwór, blokuje ściany i meble", () => {
    expect(walkable({ x: 2, z: 2.15 }, seed, true)).toBe(false);
    expect(walkable({ x: 4.6, z: 3 }, seed, false)).toBe(true);
    expect(walkable({ x: 4.6, z: 0.8 }, seed, false)).toBe(false);
    expect(walkable({ x: 99, z: 99 }, seed, false)).toBe(false);
  });
});
describe("projektor", () => {
  it("trafia w przednią powierzchnię ekranu; obrót zmienia punkt trafienia", () => {
    const p = seed.furniture.find((f) => f.kind === "projector")!;
    const hit = projectionHit(p, seed)!;
    expect(hit.z).toBeGreaterThan(4.35);
    expect(hit.x).toBeCloseTo(p.x);
    const rotated = projectionHit({ ...p, rotation: 90 }, seed)!;
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.z).toBeCloseTo(p.z);
    expect(rotated.distance).not.toBeCloseTo(hit.distance);
  });
});
describe("historia strukturalna", () => {
  it("cofanie dodania pokoju zachowuje prawidłowe zaznaczenie", () => {
    useStore.getState().load(structuredClone(seed));
    useStore.getState().addRoom("Studio", 3, 3);
    const id = useStore.getState().roomId;
    useStore.getState().undo();
    expect(
      useStore
        .getState()
        .apartment.rooms.some((r) => r.id === useStore.getState().roomId),
    ).toBe(true);
    expect(useStore.getState().roomId).not.toBe(id);
    useStore.getState().redo();
    expect(useStore.getState().apartment.rooms).toHaveLength(8);
  });
});
