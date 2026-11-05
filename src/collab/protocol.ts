import type { Apartment } from "../model/types.ts";
export interface Change {
  path: string[];
  before?: unknown;
  after?: unknown;
}
export interface Peer {
  id: string;
  name: string;
  color: string;
  selectedId: string | null;
  roomId: string;
  editing: string | null;
  cursor?: { x: number; z: number } | null;
}
export interface Invite {
  room: string;
  token: string;
  server?: string;
}
const collections = new Set(["rooms", "furniture", "openings"]);
const unsafe = new Set(["__proto__", "prototype", "constructor"]);
const plain = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export const equal = (a: unknown, b: unknown) =>
  a === b || JSON.stringify(a) === JSON.stringify(b);
export function diffProjects(before: Apartment, after: Apartment): Change[] {
  const result: Change[] = [];
  function walk(a: unknown, b: unknown, path: string[]) {
    if (a === b) return;
    if (plain(a) && plain(b)) {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
        walk(a[k], b[k], [...path, k]);
    } else if (!equal(a, b)) result.push({ path, before: a, after: b });
  }
  for (const key of Object.keys(after) as (keyof Apartment)[]) {
    if (collections.has(key)) {
      const old = new Map(
          (before[key] as { id: string }[]).map((x) => [x.id, x]),
        ),
        next = new Map((after[key] as { id: string }[]).map((x) => [x.id, x]));
      for (const id of new Set([...old.keys(), ...next.keys()]))
        walk(old.get(id), next.get(id), [key, id]);
    } else walk(before[key], after[key], [key]);
  }
  return result;
}
export function readPath(a: Apartment, path: string[]): unknown {
  if (collections.has(path[0])) {
    const list = a[path[0] as "rooms"] as { id: string }[],
      item = list.find((x) => x.id === path[1]);
    let current: unknown = item;
    for (const k of path.slice(2)) {
      if (!plain(current)) return undefined;
      current = current[k];
    }
    return current;
  }
  let current: unknown = a;
  for (const k of path) {
    if (!plain(current)) return undefined;
    current = current[k];
  }
  return current;
}
function edit(value: unknown, path: string[], after: unknown): unknown {
  if (!path.length) return after;
  const [key, ...rest] = path;
  const next = { ...(plain(value) ? value : {}) };
  if (!rest.length && after === undefined) delete next[key];
  else next[key] = edit(next[key], rest, after);
  return next;
}
export function applyChanges(
  a: Apartment,
  changes: Change[],
  checked = false,
): Apartment {
  let next = a;
  for (const c of changes) {
    if (!validChange(c)) throw Error("Invalid shared edit.");
    if (
      checked &&
      !equal(readPath(next, c.path), c.before) &&
      !equal(readPath(next, c.path), c.after)
    )
      throw Error(
        "A partner changed the same field. Your unconfirmed edit was not applied.",
      );
    const [collection, id, ...path] = c.path;
    if (collections.has(collection)) {
      const key = collection as "rooms",
        list = next[key] as { id: string }[],
        index = list.findIndex((x) => x.id === id),
        value = edit(list[index], path, c.after);
      let updated = [...list];
      if (value === undefined) {
        updated = updated.filter((x) => x.id !== id);
      } else if (index < 0) {
        updated.push(value as { id: string });
      } else updated[index] = value as { id: string };
      next = { ...next, [key]: updated } as Apartment;
    } else next = edit(next, c.path, c.after) as Apartment;
  }
  return next;
}
export function validChange(c: unknown): c is Change {
  if (
    !plain(c) ||
    !Array.isArray(c.path) ||
    c.path.length < 1 ||
    c.path.length > 10 ||
    c.path.some(
      (k) =>
        typeof k !== "string" || !k.length || k.length > 160 || unsafe.has(k),
    )
  )
    return false;
  const root = c.path[0];
  return (
    [
      "rooms",
      "furniture",
      "openings",
      "name",
      "notes",
      "rate",
      "budget",
      "id",
      "schemaVersion",
    ].includes(root) &&
    (!collections.has(root) || c.path.length >= 2) &&
    !(collections.has(root) && c.path.length > 2 && c.path[2] === "id") &&
    !(
      collections.has(root) &&
      c.path.length === 2 &&
      c.after !== undefined &&
      (!plain(c.after) || c.after.id !== c.path[1])
    )
  );
}
export function changeKeys(a: Apartment, changes: Change[]) {
  const keys = new Set<string>();
  for (const c of changes) {
    if (collections.has(c.path[0])) {
      keys.add(`${c.path[0]}:${c.path[1]}`);
      if (c.path[0] !== "rooms") {
        const item = (
          a[c.path[0] as "furniture"] as { id: string; roomId: string }[]
        ).find((f) => f.id === c.path[1]);
        const next =
          c.path.length === 2
            ? (c.after as { roomId?: string } | undefined)
            : undefined;
        for (const roomId of [item?.roomId, next?.roomId])
          if (roomId) keys.add(`rooms:${roomId}`);
      }
    }
  }
  return keys;
}
export function mergeChanges(queue: Change[], incoming: Change[]) {
  let result = [...queue];
  const prefix = (a: string[], b: string[]) =>
    a.length <= b.length && a.every((k, i) => k === b[i]);
  for (const c of incoming) {
    const ancestor = result.findIndex((old) => prefix(old.path, c.path));
    if (ancestor >= 0) {
      const old = result[ancestor],
        next = {
          path: old.path,
          before: old.before,
          after: edit(old.after, c.path.slice(old.path.length), c.after),
        };
      result.splice(
        ancestor,
        1,
        ...(equal(next.before, next.after) ? [] : [next]),
      );
      continue;
    }
    const descendants = result.filter((old) => prefix(c.path, old.path));
    let before = c.before;
    for (const old of [...descendants].reverse())
      before = edit(before, old.path.slice(c.path.length), old.before);
    result = result.filter((old) => !descendants.includes(old));
    const next = { ...c, before };
    if (!equal(next.before, next.after)) result.push(next);
  }
  return result;
}
export const reverseChanges = (changes: Change[]) =>
  changes.map((c) => ({ path: c.path, before: c.after, after: c.before }));
