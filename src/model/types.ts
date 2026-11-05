export type Vec2 = { x: number; z: number };
export type Material =
  | "wood"
  | "fabric"
  | "ceramic"
  | "glass"
  | "metal"
  | "matte"
  | "plaster"
  | "stone";
export type TexturePreset =
  | "auto"
  | "none"
  | "wood"
  | "linen"
  | "tiles"
  | "brick"
  | "concrete"
  | "marble"
  | "stripes"
  | "custom";
export interface SurfaceStyle {
  color: string;
  material: Material;
  texture: TexturePreset;
  repeat: number;
  rotation: number;
  roughness: number;
  image?: string;
  imageName?: string;
}
export interface Wall {
  id: string;
  start: Vec2;
  end: Vec2;
  height: number;
  thickness: number;
}
export interface Opening {
  surface?: SurfaceStyle;
  id: string;
  roomId: string;
  wallIndex: number;
  kind: "door" | "window" | "passage";
  offset: number;
  width: number;
  height: number;
  sill: number;
}
export interface Room {
  floorSurface?: SurfaceStyle;
  wallSurface?: SurfaceStyle;
  wallSurfaces?: Record<number, SurfaceStyle>;
  id: string;
  name: string;
  points: Vec2[];
  color: string;
  notes: string;
}
export type FurnitureKind =
  | "sofa"
  | "bed"
  | "wardrobe"
  | "nightstand"
  | "desk"
  | "chair"
  | "table"
  | "shelf"
  | "lamp"
  | "rug"
  | "curtain"
  | "mirror"
  | "vase"
  | "freesia-yellow"
  | "freesia-white"
  | "freesia-pink"
  | "plant"
  | "counter"
  | "sink"
  | "hob"
  | "fridge"
  | "bath"
  | "toilet"
  | "projector"
  | "screen";
export interface FurnitureItem {
  surface?: SurfaceStyle;
  id: string;
  roomId: string;
  kind: FurnitureKind;
  name: string;
  x: number;
  z: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  color: string;
  material: Material;
  cost: number;
  notes: string;
  purchased: boolean;
  vase: "ceramic" | "glass" | "slim";
  enabled: boolean;
}
export interface Apartment {
  schemaVersion: 1;
  id: string;
  name: string;
  rooms: Room[];
  openings: Opening[];
  furniture: FurnitureItem[];
  rate: number;
  budget: number;
  notes: string;
}
export interface ProjectVersion {
  id: string;
  name: string;
  createdAt: string;
  apartment: Apartment;
}
export interface ShoppingItem {
  id: string;
  name: string;
  roomId: string;
  cost: number;
  purchased: boolean;
}
export interface CatalogEntry {
  kind: FurnitureKind;
  name: string;
  category: string;
  width: number;
  depth: number;
  height: number;
  color: string;
  material: Material;
}
