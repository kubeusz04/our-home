import { SurfaceFinish, PaintMaterial } from "./SurfaceMaterial";
import { itemSurface } from "../model/surfaces";
import { surfaceTexture } from "./materials";
import type { Material } from "../model/types";
import { RoundedBox } from "@react-three/drei";
import type { FurnitureItem } from "../model/types";
import { useStore } from "../model/store";
function Box({
  p = [0, 0, 0],
  s = [1, 1, 1],
  color,
  round = 0.025,
  metal = false,
  glass = false,
  material = "matte",
}: {
  p?: [number, number, number];
  s?: [number, number, number];
  color: string;
  round?: number;
  metal?: boolean;
  glass?: boolean;
  material?: Material;
}) {
  return (
    <RoundedBox
      position={p}
      args={s}
      radius={Math.min(round, ...s.map((v) => v / 3))}
      smoothness={2}
      castShadow
      receiveShadow
    >
      <PaintMaterial
        map={surfaceTexture(material)}
        color={color}
        roughness={
          metal
            ? 0.28
            : glass
              ? 0.12
              : material === "ceramic"
                ? 0.25
                : material === "fabric"
                  ? 0.98
                  : 0.72
        }
        metalness={metal ? 0.65 : 0}
        transparent={glass}
        opacity={glass ? 0.45 : 1}
      />
    </RoundedBox>
  );
}
function Leg({ x, z, h = 0.3 }: { x: number; z: number; h?: number }) {
  return <Box p={[x, h / 2, z]} s={[0.045, h, 0.045]} color="#886848" />;
}
export default function FurnitureModel({ item: f }: { item: FurnitureItem }) {
  const evening = useStore((s) => s.evening),
    c = f.color,
    wood = f.material === "wood" ? c : "#ae8961",
    metal = f.material === "metal",
    glass = f.material === "glass";
  const B = (
    p: [number, number, number],
    s: [number, number, number],
    col = c,
    r = 0.025,
  ) => (
    <Box
      p={p}
      s={s}
      color={col}
      round={r}
      material={f.material}
      metal={metal}
      glass={glass}
    />
  );
  const legs = (h = 0.25) =>
    [-0.38, 0.38].flatMap((x) =>
      [-0.35, 0.35].map((z) => <Leg key={`${x}${z}`} x={x} z={z} h={h} />),
    );
  let content;
  switch (f.kind) {
    case "sofa":
      content = (
        <>
          {legs(0.18)}
          {B([0, 0.3, 0], [0.97, 0.35, 0.95])}
          {B([0, 0.7, 0.38], [0.94, 0.6, 0.19])}
          {[-0.31, 0, 0.31].map((x) => (
            <Box
              key={x}
              p={[x, 0.51, -0.06]}
              s={[0.3, 0.2, 0.66]}
              color={c}
              material={f.material}
              round={0.06}
            />
          ))}
          {[-0.44, 0.44].map((x) => (
            <Box
              key={x}
              p={[x, 0.53, -0.02]}
              s={[0.13, 0.48, 0.95]}
              color={c}
              material={f.material}
              round={0.06}
            />
          ))}
          {B([-0.23, 0.76, 0.23], [0.23, 0.3, 0.12], "#eadfc8", 0.06)}
          {B([0.2, 0.75, 0.22], [0.23, 0.29, 0.13], "#c99590", 0.06)}
        </>
      );
      break;
    case "bed":
      content = (
        <>
          {legs(0.15)}
          {B([0, 0.28, 0], [1, 0.3, 1], wood)}
          {B([0, 0.85, 0.46], [1, 0.3, 0.08], wood)}
          {B([0, 0.52, 0], [0.96, 0.27, 0.94], "#eee5d4", 0.08)}
          {B([0, 0.68, -0.15], [0.96, 0.1, 0.6], c)}
          {[-0.24, 0.24].map((x) => (
            <Box
              key={x}
              p={[x, 0.71, 0.29]}
              s={[0.4, 0.13, 0.23]}
              color="#f5eddd"
              round={0.06}
            />
          ))}
        </>
      );
      break;
    case "table":
      content = (
        <>
          {legs(0.88)}
          {B([0, 0.94, 0], [1, 0.12, 1], c, 0.1)}
        </>
      );
      break;
    case "desk":
      content = (
        <>
          {legs(0.9)}
          {B([0, 0.79, 0], [1, 0.08, 1], wood)}
          {B([0, 1.06, 0.22], [0.46, 0.42, 0.06], "#354440")}
          {B([0, 0.91, 0.17], [0.03, 0.2, 0.04], "#555b55")}
          {B([0, 0.84, 0.17], [0.2, 0.025, 0.2], "#555b55")}
          {B([0, 0.845, -0.16], [0.32, 0.02, 0.18], "#767a6f")}
        </>
      );
      break;
    case "chair":
      content = (
        <>
          {legs(0.55)}
          {B([0, 0.56, 0], [0.96, 0.13, 0.96], c, 0.08)}
          {B([0, 0.8, 0.37], [0.95, 0.4, 0.15], c, 0.07)}
        </>
      );
      break;
    case "wardrobe":
      content = (
        <>
          {B([0, 0.5, 0], [1, 1, 1], wood)}
          {[-0.24, 0.24].map((x) => (
            <Box
              key={x}
              p={[x, 0.5, -0.51]}
              s={[0.47, 0.96, 0.025]}
              color={c}
            />
          ))}
          {[-0.04, 0.04].map((x) => (
            <Box
              key={x}
              p={[x, 0.5, -0.54]}
              s={[0.014, 0.1, 0.025]}
              color="#594a37"
            />
          ))}
        </>
      );
      break;
    case "nightstand":
    case "counter":
    case "sink":
    case "hob":
      content = (
        <>
          {B([0, 0.47, 0], [1, 0.94, 1], wood)}
          {B(
            [0, 0.97, 0],
            [1.04, 0.06, 1.03],
            f.kind === "nightstand" ? c : "#eee5d7",
          )}
          {B([0, 0.57, -0.51], [0.25, 0.03, 0.03], "#7f6a4b")}
          {f.kind === "sink" && (
            <>
              {B([0, 1.01, 0], [0.65, 0.025, 0.65], "#9fa7a1")}
              {B([0, 1.12, 0.3], [0.03, 0.3, 0.03], "#a4aaa3")}
              {B([0, 1.25, 0.2], [0.03, 0.025, 0.25], "#a4aaa3")}
            </>
          )}
          {f.kind === "hob" && (
            <>
              {B([0, 1.015, 0], [0.94, 0.025, 0.9], "#303936")}
              {[-0.23, 0.23].flatMap((x) =>
                [-0.23, 0.23].map((z) => (
                  <mesh
                    key={`${x}${z}`}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[x, 1.035, z]}
                  >
                    <ringGeometry args={[0.12, 0.15, 24]} />
                    <PaintMaterial color="#777b73" />
                  </mesh>
                )),
              )}
            </>
          )}
        </>
      );
      break;
    case "fridge":
      content = (
        <>
          {B([0, 0.5, 0], [1, 1, 1])}
          {B([0, 0.65, -0.52], [0.96, 0.66, 0.025])}
          {B([0, 0.15, -0.52], [0.96, 0.29, 0.025])}
          {B([-0.38, 0.6, -0.55], [0.03, 0.2, 0.04], "#7d8179")}
        </>
      );
      break;
    case "shelf":
      content = (
        <>
          {[-0.47, 0.47].map((x) => (
            <Box key={x} p={[x, 0.5, 0]} s={[0.06, 1, 1]} color={wood} />
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((y) => (
            <group key={y}>
              {B([0, y, 0], [1, 0.035, 1], wood)}
              {y < 1 &&
                [0, 1, 2, 3].map((i) => (
                  <Box
                    key={i}
                    p={[-0.25 + i * 0.12, y + 0.11, 0.1]}
                    s={[0.08, 0.18, 0.5]}
                    color={["#a5ac8b", "#c99a86", "#eadbc0", "#87775b"][i]}
                  />
                ))}
            </group>
          ))}
        </>
      );
      break;
    case "lamp":
      content = (
        <>
          {B([0, 0.02, 0], [0.6, 0.04, 0.6], "#9f805a")}
          {B([0, 0.35, 0], [0.045, 0.68, 0.045], "#9f805a")}
          <mesh position={[0, 0.75, 0]} castShadow>
            <sphereGeometry args={[0.45, 24, 16]} />
            <PaintMaterial
              color={c}
              emissive="#ffd58a"
              emissiveIntensity={evening ? 0.7 : 0.25}
              roughness={0.9}
            />
          </mesh>
          {evening && (
            <pointLight
              position={[0, 0.75, 0]}
              color="#ffd299"
              intensity={2}
              distance={4}
            />
          )}
        </>
      );
      break;
    case "rug":
      content = B([0, 0.5, 0], [1, 1, 1], c, 0.08);
      break;
    case "curtain":
      content = (
        <>
          {Array.from({ length: 14 }, (_, i) => (
            <Box
              key={i}
              p={[-0.46 + i * 0.07, 0.5, Math.sin(i * 2) * 0.2]}
              s={[0.08, 1, 0.3]}
              color={c}
              material={f.material}
              round={0.035}
            />
          ))}
        </>
      );
      break;
    case "mirror":
    case "screen":
      content = (
        <>
          {B([0, 0.5, 0], [1, 1, 1], wood)}
          {B([0, 0.5, -0.55], [0.94, 0.94, 0.05], c)}
          {f.kind === "mirror" &&
            B([-0.15, 0.56, -0.59], [0.018, 0.7, 0.025], "#edf4ef")}
        </>
      );
      break;
    case "projector":
      content = (
        <>
          {B([0, 0.5, 0], [1, 1, 1], c, 0.13)}
          <mesh position={[0.23, 0.5, -0.53]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.08, 24]} />
            <PaintMaterial
              color="#374942"
              emissive="#86c2ce"
              emissiveIntensity={f.enabled ? 0.5 : 0}
            />
          </mesh>
          {[-0.25, -0.13, 0].map((x) => (
            <Box
              key={x}
              p={[x, 0.5, -0.51]}
              s={[0.045, 0.4, 0.035]}
              color="#9eaba1"
            />
          ))}
        </>
      );
      break;
    case "bath":
      content = (
        <>
          {B([0, 0.42, 0], [1, 0.84, 1], c, 0.15)}
          {B([0, 0.86, 0], [0.78, 0.04, 0.84], "#b9c9c4", 0.1)}
          {B([0, 0.88, 0.4], [0.12, 0.06, 0.05], "#a0a8a0")}
        </>
      );
      break;
    case "toilet":
      content = (
        <>
          {B([0, 0.2, 0], [0.6, 0.4, 0.6])}
          {B([0, 0.55, -0.08], [1, 0.27, 0.95], c, 0.15)}
          {B([0, 0.85, 0.3], [0.9, 0.3, 0.35])}
          {B([0, 0.7, -0.13], [0.65, 0.02, 0.55], "#c7cfc8", 0.1)}
        </>
      );
      break;
    default:
      content = (
        <>
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry
              args={[f.vase === "slim" ? 0.19 : 0.3, 0.22, 0.36, 18]}
            />
            <PaintMaterial
              color={f.kind === "vase" ? c : "#d6c7a9"}
              transparent={f.vase === "glass"}
              opacity={f.vase === "glass" ? 0.4 : 1}
              roughness={0.5}
            />
          </mesh>
          {f.kind !== "vase" &&
            Array.from({ length: f.kind === "plant" ? 9 : 7 }, (_, i) => {
              const a = i * 2.4,
                x = Math.cos(a) * 0.3,
                z = Math.sin(a) * 0.3,
                h = 0.55 + (i % 3) * 0.15;
              return (
                <group key={i}>
                  <mesh
                    position={[x / 2, h / 2 + 0.15, z / 2]}
                    rotation={[z * 0.7, 0, -x * 0.7]}
                  >
                    <cylinderGeometry args={[0.014, 0.017, h, 6]} />
                    <PaintMaterial color="#6b8550" />
                  </mesh>
                  {f.kind === "plant" ? (
                    <mesh
                      position={[x, h, z]}
                      rotation={[0.4, a, 0.5]}
                      scale={[0.18, 0.3, 0.09]}
                      castShadow
                    >
                      <sphereGeometry args={[1, 12, 8]} />
                      <PaintMaterial color={c} />
                    </mesh>
                  ) : (
                    <group position={[x, h, z]}>
                      {[0, 1, 2, 3, 4].map((j) => (
                        <mesh
                          key={j}
                          position={[
                            Math.cos(j * 1.26) * 0.065,
                            Math.sin(j * 1.26) * 0.04,
                            0,
                          ]}
                          scale={[0.065, 0.05, 0.045]}
                        >
                          <sphereGeometry args={[1, 8, 6]} />
                          <PaintMaterial color={c} />
                        </mesh>
                      ))}
                    </group>
                  )}
                </group>
              );
            })}
        </>
      );
  }
  return (
    <SurfaceFinish surface={itemSurface(f)}>
      <group scale={[f.width, f.height, f.depth]}>{content}</group>
    </SurfaceFinish>
  );
}
