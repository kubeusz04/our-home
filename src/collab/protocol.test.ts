import { describe, it, expect } from "vitest";
import { seed } from "../model/seed";
import {
  applyChanges,
  diffProjects,
  mergeChanges,
  reverseChanges,
  validChange,
} from "./protocol";
describe("shared edits", () => {
  it("merges independent partner edits and undoes only the author field", () => {
    const a = structuredClone(seed),
      b = structuredClone(a),
      c = structuredClone(a);
    b.furniture[0].x += 0.2;
    c.furniture[0].color = "#abcdef";
    const own = diffProjects(a, b),
      other = diffProjects(a, c);
    const together = applyChanges(applyChanges(a, own, true), other, true);
    expect(together.furniture[0].x).toBe(b.furniture[0].x);
    const undone = applyChanges(together, reverseChanges(own), true);
    expect(undone.furniture[0].color).toBe("#abcdef");
    expect(undone.furniture[0].x).toBe(a.furniture[0].x);
  });
  it("coalesces creation, drag and deletion within one send interval", () => {
    const a = structuredClone(seed),
      b = structuredClone(a);
    const item = { ...a.furniture[0], id: "new-item" };
    b.furniture.push(item);
    const c = structuredClone(b);
    c.furniture.at(-1)!.x += 1;
    const merged = mergeChanges(diffProjects(a, b), diffProjects(b, c));
    expect(applyChanges(a, merged, true)).toEqual(c);
    expect(mergeChanges(merged, diffProjects(c, a))).toEqual([]);
  });
  it("rejects stale writes and unsafe paths", () => {
    const a = structuredClone(seed),
      b = structuredClone(a),
      c = structuredClone(a);
    b.name = "Alex";
    c.name = "Bob";
    expect(() => applyChanges(b, diffProjects(a, c), true)).toThrow();
    expect(validChange({ path: ["rooms", "x", "__proto__"], after: {} })).toBe(
      false,
    );
    expect(
      validChange({ path: ["furniture", "x"], after: { id: "other" } }),
    ).toBe(false);
  });
});
