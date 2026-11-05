import { createContext } from "react";
import type { Texture } from "three";
import type { SurfaceStyle } from "../model/types";
export const FinishContext = createContext<{
  surface: SurfaceStyle;
  map: Texture | null;
} | null>(null);
