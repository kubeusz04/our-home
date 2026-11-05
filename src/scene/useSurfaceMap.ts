import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { SurfaceStyle } from "../model/types";
import { effectiveTexture } from "../model/surfaces";
import { patternCanvas } from "../model/texturePatterns";
import { useStore } from "../model/store";
const decoded = new Map<string, Promise<HTMLImageElement>>();
function imageAsset(url: string) {
  if (decoded.has(url)) return decoded.get(url)!;
  const task = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode texture."));
    img.src = url;
  });
  decoded.set(url, task);
  if (decoded.size > 12) decoded.delete(decoded.keys().next().value!);
  return task;
}
/** Each binding owns its texture transform; image pixels can be shared safely. */
export function useSurfaceMap(surface?: SurfaceStyle) {
  const pattern = surface ? effectiveTexture(surface) : "none",
    url = pattern === "custom" ? surface?.image : undefined,
    repeat = surface?.repeat ?? 1,
    rotation = surface?.rotation ?? 0;
  const [loaded, setLoaded] = useState<{
    url: string;
    image: HTMLImageElement;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    if (url)
      imageAsset(url)
        .then((image) => {
          if (alive) setLoaded({ url, image });
        })
        .catch(() => {
          if (alive)
            useStore
              .getState()
              .notify(
                "Could not load the texture image. Choose another PNG, JPG or WebP image.",
              );
        });
    return () => {
      alive = false;
    };
  }, [url]);
  const map = useMemo(() => {
    if (pattern === "none") return null;
    const source =
      pattern === "custom"
        ? loaded && loaded.url === url
          ? loaded.image
          : null
        : patternCanvas(pattern);
    if (!source) return null;
    const texture = new THREE.Texture(source);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.center.set(0.5, 0.5);
    texture.rotation = THREE.MathUtils.degToRad(rotation);
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }, [pattern, url, loaded, repeat, rotation]);
  useEffect(() => () => map?.dispose(), [map]);
  return map;
}
