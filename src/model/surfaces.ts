import type {
  FurnitureItem,
  Material,
  Opening,
  Room,
  SurfaceStyle,
  TexturePreset,
  Wall,
} from "./types.ts";
export const materialNames: Material[] = [
  "wood",
  "fabric",
  "ceramic",
  "glass",
  "metal",
  "matte",
  "plaster",
  "stone",
];
export const texturePresets: { id: TexturePreset; name: string }[] = [
  { id: "auto", name: "Match material" },
  { id: "none", name: "Solid colour" },
  { id: "wood", name: "Wood grain" },
  { id: "linen", name: "Woven linen" },
  { id: "tiles", name: "Tiles" },
  { id: "brick", name: "Brick" },
  { id: "concrete", name: "Concrete" },
  { id: "marble", name: "Marble" },
  { id: "stripes", name: "Wallpaper stripes" },
  { id: "custom", name: "Custom image" },
];
export const defaultSurface = (
  color = "#eee5d7",
  material: Material = "matte",
): SurfaceStyle => ({
  color,
  material,
  texture: "auto",
  repeat: 1,
  rotation: 0,
  roughness:
    material === "metal"
      ? 0.28
      : material === "glass"
        ? 0.12
        : material === "ceramic"
          ? 0.25
          : material === "fabric"
            ? 0.98
            : 0.8,
});
export const itemSurface = (f: FurnitureItem): SurfaceStyle => ({
  ...defaultSurface(f.color, f.material),
  ...f.surface,
  color: f.color,
  material: f.material,
});
export const floorSurface = (r: Room): SurfaceStyle => ({
  ...defaultSurface(r.color, "wood"),
  texture: "wood",
  ...r.floorSurface,
  color: r.color,
});
export const wallSurface = (r: Room, index?: number): SurfaceStyle =>
  r.wallSurfaces?.[index ?? -1] ??
  r.wallSurface ?? {
    ...defaultSurface("#eee5d7", "plaster"),
    texture: "none",
    roughness: 0.9,
  };
export const openingSurface = (o: Opening): SurfaceStyle =>
  o.surface ??
  defaultSurface(
    o.kind === "window" ? "#7d725d" : "#bca17d",
    o.kind === "window" ? "metal" : "wood",
  );
export const effectiveTexture = (s: SurfaceStyle): TexturePreset =>
  s.texture === "auto"
    ? s.material === "wood"
      ? "wood"
      : s.material === "fabric"
        ? "linen"
        : "none"
    : s.texture;
export function validSurface(s: unknown): s is SurfaceStyle {
  if (!s || typeof s !== "object") return false;
  const a = s as SurfaceStyle;
  return (
    /^#[\da-f]{6}$/i.test(a.color) &&
    materialNames.includes(a.material) &&
    texturePresets.some((p) => p.id === a.texture) &&
    Number.isFinite(a.repeat) &&
    a.repeat >= 0.25 &&
    a.repeat <= 20 &&
    Number.isFinite(a.rotation) &&
    Math.abs(a.rotation) <= 360 &&
    Number.isFinite(a.roughness) &&
    a.roughness >= 0 &&
    a.roughness <= 1 &&
    (a.imageName === undefined ||
      (typeof a.imageName === "string" && a.imageName.length <= 200)) &&
    (a.image === undefined ||
      (typeof a.image === "string" &&
        a.image.length <= 1500000 &&
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z\d+/]+={0,2}$/.test(
          a.image,
        ))) &&
    (a.texture !== "custom" || !!a.image)
  );
}
export function wallIndexForSegment(room: Room, wall: Wall) {
  return room.points.findIndex((p, i) => {
    const q = room.points[(i + 1) % room.points.length],
      dx = q.x - p.x,
      dz = q.z - p.z,
      len = Math.hypot(dx, dz),
      mid = {
        x: (wall.start.x + wall.end.x) / 2,
        z: (wall.start.z + wall.end.z) / 2,
      },
      along = ((mid.x - p.x) * dx + (mid.z - p.z) * dz) / len;
    return (
      Math.abs((mid.x - p.x) * dz - (mid.z - p.z) * dx) < 0.002 &&
      along >= -0.002 &&
      along <= len + 0.002
    );
  });
}
