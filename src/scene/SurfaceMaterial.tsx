import { useContext } from "react";
import type { ReactNode } from "react";
import type { ThreeElements } from "@react-three/fiber";
import type { SurfaceStyle } from "../model/types";
import { useSurfaceMap } from "./useSurfaceMap";
import { FinishContext } from "./finishContext";
export function SurfaceFinish({
  surface,
  children,
}: {
  surface: SurfaceStyle;
  children: ReactNode;
}) {
  const map = useSurfaceMap(surface);
  return (
    <FinishContext.Provider value={{ surface, map }}>
      {children}
    </FinishContext.Provider>
  );
}
export function PaintMaterial({
  surface,
  ...props
}: ThreeElements["meshStandardMaterial"] & { surface?: SurfaceStyle }) {
  const inherited = useContext(FinishContext),
    ownMap = useSurfaceMap(surface),
    style = surface ?? inherited?.surface,
    map = surface ? ownMap : inherited?.map;
  return (
    <meshStandardMaterial
      {...props}
      onUpdate={(material) => {
        material.needsUpdate = true;
      }}
      color={surface?.color ?? props.color}
      map={style ? map : props.map}
      roughness={style?.roughness ?? props.roughness}
      metalness={style?.material === "metal" ? 0.65 : (props.metalness ?? 0)}
      transparent={style?.material === "glass" || props.transparent}
      opacity={style?.material === "glass" ? 0.45 : (props.opacity ?? 1)}
    />
  );
}
