import * as THREE from "three";
import type { Material } from "../model/types";
const textures = new Map<string, THREE.CanvasTexture>();
export function surfaceTexture(material: Material) {
  if (material !== "wood" && material !== "fabric") return null;
  if (textures.has(material)) return textures.get(material)!;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 128, 128);
  if (material === "wood") {
    for (let i = 0; i < 45; i++) {
      ctx.strokeStyle = `rgba(75,55,25,${0.025 + (i % 5) * 0.009})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let y = 0; y <= 128; y += 4) {
        const x = i * 3 + Math.sin(y / 32 + i) * 1.7;
        if (y) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = "#00000010";
    ctx.lineWidth = 1;
    for (let x = 0; x < 128; x += 3) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, x);
      ctx.lineTo(128, x);
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  textures.set(material, t);
  return t;
}
