import { useMemo, useEffect } from "react";
import * as THREE from "three";
import type { Apartment, FurnitureItem } from "../model/types";
import { projectionHit } from "../model/projection";
function projectionTexture() {
  const c = document.createElement("canvas");
  c.width = 768;
  c.height = 432;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 432);
  g.addColorStop(0, "#8986b7");
  g.addColorStop(0.6, "#e8b4ac");
  g.addColorStop(1, "#efcfa9");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 768, 432);
  ctx.fillStyle = "#fff6d9";
  ctx.beginPath();
  ctx.arc(585, 95, 38, 0, Math.PI * 2);
  ctx.fill();
  for (let j = 0; j < 3; j++) {
    ctx.fillStyle = ["#aaa0b9", "#777f9b", "#535f76"][j];
    ctx.beginPath();
    ctx.moveTo(0, 432);
    for (let x = 0; x <= 800; x += 20)
      ctx.lineTo(
        x,
        230 + j * 50 - Math.sin(x / 100 + j * 2) * 35 - Math.cos(x / 60) * 18,
      );
    ctx.lineTo(800, 432);
    ctx.fill();
  }
  ctx.strokeStyle = "#554f60";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(55, 432);
  ctx.quadraticCurveTo(135, 225, 53, 50);
  ctx.moveTo(100, 260);
  ctx.quadraticCurveTo(220, 180, 300, 160);
  ctx.stroke();
  for (let i = 0; i < 95; i++) {
    const x = 45 + (Math.sin(i * 17) * 0.5 + 0.5) * 250,
      y = 60 + (Math.cos(i * 23) * 0.5 + 0.5) * 220;
    ctx.fillStyle = i % 2 ? "#f4c1cd" : "#e9a7bc";
    ctx.beginPath();
    ctx.arc(x, y, 5 + (i % 4), 0, 6.3);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}
export default function Projector({
  item: f,
  apartment: a,
}: {
  item: FurnitureItem;
  apartment: Apartment;
}) {
  const hit = useMemo(() => projectionHit(f, a), [f, a]),
    texture = useMemo(() => projectionTexture(), []);
  const beam = useMemo(() => {
    if (!hit) return null;
    const width = Math.min(hit.distance * 0.68, hit.maxWidth, 3),
      height = (width * 9) / 16,
      centerY = f.y + f.height / 2;
    const dx = (Math.cos(hit.angle) * width) / 2,
      dz = (-Math.sin(hit.angle) * width) / 2;
    const corners = [
      [hit.x - dx, centerY - height / 2, hit.z - dz],
      [hit.x + dx, centerY - height / 2, hit.z + dz],
      [hit.x + dx, centerY + height / 2, hit.z + dz],
      [hit.x - dx, centerY + height / 2, hit.z - dz],
    ];
    const vertices = [];
    for (let i = 0; i < 4; i++)
      vertices.push(f.x, centerY, f.z, ...corners[i], ...corners[(i + 1) % 4]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geom.computeVertexNormals();
    return { geom, width, height, centerY };
  }, [hit, f.x, f.y, f.z, f.height]);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => beam?.geom.dispose(), [beam]);
  if (!f.enabled || !hit || !beam) return null;
  const offX = ((f.x - hit.x) / hit.distance) * 0.012,
    offZ = ((f.z - hit.z) / hit.distance) * 0.012;
  return (
    <group>
      <mesh geometry={beam.geom}>
        <meshBasicMaterial
          color="#d2c8ee"
          transparent
          opacity={0.055}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh
        position={[hit.x + offX, beam.centerY, hit.z + offZ]}
        rotation={[0, hit.angle, 0]}
      >
        <planeGeometry args={[beam.width, beam.height]} />
        <meshBasicMaterial
          map={texture}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
