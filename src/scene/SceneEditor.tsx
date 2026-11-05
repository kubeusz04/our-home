import { collaborationBridge } from "../collab/bridge";
import { useCoopStore } from "../collab/client";
import { floorSurface, wallSurface, openingSurface } from "../model/surfaces";
import { PaintMaterial } from "./SurfaceMaterial";
import { useSurfaceMap } from "./useSurfaceMap";
/* oxlint-disable react/immutability -- Three.js cameras are imperative objects updated by the R3F render loop. */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "../model/store";
import { bounds, contains, walkable, wallSegments } from "../model/geometry";
import type { FurnitureItem, Room, Wall, Opening } from "../model/types";
import FurnitureModel from "./FurnitureModel";
import Projector from "./Projector";
let transforming = false,
  ignoreClickUntil = 0;
function Floor({ room }: { room: Room }) {
  const shape = useMemo(() => {
    const sh = new THREE.Shape();
    room.points.forEach((p, i) =>
      i ? sh.lineTo(p.x, -p.z) : sh.moveTo(p.x, -p.z),
    );
    sh.closePath();
    return sh;
  }, [room.points]);
  const lines = useMemo(() => {
    const b = bounds(room);
    const pos: number[] = [];
    for (let x = b.minX + 0.15; x < b.maxX; x += 0.18) {
      for (let z = b.minZ; z < b.maxZ; z += 0.08) {
        if (contains({ x, z }, room) && contains({ x, z: z + 0.08 }, room))
          pos.push(x, 0.008, z, x, 0.008, z + 0.08);
      }
    }
    return new Float32Array(pos);
  }, [room]);
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          if (transforming || performance.now() < ignoreClickUntil) return;
          useStore.setState({
            roomId: room.id,
            selectedId: null,
            selectedWall: null,
          });
        }}
      >
        <shapeGeometry args={[shape]} />
        <PaintMaterial surface={floorSurface(room)} />
      </mesh>
      {!room.floorSurface && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[lines, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#8f795b" transparent opacity={0.17} />
        </lineSegments>
      )}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.2, 0]}
        receiveShadow
      >
        <extrudeGeometry args={[shape, { depth: 0.19, bevelEnabled: false }]} />
        <meshStandardMaterial color="#d0b998" />
      </mesh>
    </group>
  );
}
function WallMesh({
  wall: w,
  openings,
  room,
  exterior,
  sides,
}: {
  wall: Wall;
  openings: Opening[];
  room: Room;
  exterior: boolean;
  sides: { room: Room; wallIndex: number; positive: boolean }[];
}) {
  const plus = sides.find((s) => s.positive) ?? sides[0],
    minus = sides.find((s) => !s.positive) ?? sides[0];
  const plusStyle = wallSurface(plus.room, plus.wallIndex),
    minusStyle = wallSurface(minus.room, minus.wallIndex),
    plusMap = useSurfaceMap(plusStyle),
    minusMap = useSurfaceMap(minusStyle);
  const group = useRef<THREE.Group>(null),
    show = useStore((s) => s.showWalls),
    walk = useStore((s) => s.view === "walk");
  const dx = w.end.x - w.start.x,
    dz = w.end.z - w.start.z,
    len = Math.hypot(dx, dz),
    angle = -Math.atan2(dz, dx);
  const b = bounds(room),
    cx = (b.minX + b.maxX) / 2,
    cz = (b.minZ + b.maxZ) / 2,
    mx = (w.start.x + w.end.x) / 2,
    mz = (w.start.z + w.end.z) / 2;
  useFrame(({ camera }) => {
    if (group.current) {
      const near =
        (camera.position.x - mx) * (mx - cx) +
          (camera.position.z - mz) * (mz - cz) >
        0;
      group.current.visible = show;
      group.current.scale.y =
        (room.id === "balcony" ? 0.4 : 1) *
        (walk ? 1 : near ? 0.18 : exterior ? 1 : 0.24);
    }
  });
  const pieces: { x: number; y: number; width: number; height: number }[] = [];
  let cursor = 0;
  for (const o of [...openings].sort((a, b) => a.offset - b.offset)) {
    const left = Math.max(cursor, Math.min(len, o.offset)),
      right = Math.min(len, left + o.width);
    if (left > cursor)
      pieces.push({
        x: (cursor + left) / 2,
        y: 1.35,
        width: left - cursor,
        height: 2.7,
      });
    if (o.sill > 0)
      pieces.push({
        x: (left + right) / 2,
        y: o.sill / 2,
        width: right - left,
        height: o.sill,
      });
    const top = Math.min(2.7, o.sill + o.height);
    if (top < 2.7)
      pieces.push({
        x: (left + right) / 2,
        y: (2.7 + top) / 2,
        width: right - left,
        height: 2.7 - top,
      });
    cursor = right;
  }
  if (cursor < len)
    pieces.push({
      x: (cursor + len) / 2,
      y: 1.35,
      width: len - cursor,
      height: 2.7,
    });
  return (
    <group
      ref={group}
      position={[w.start.x, 0, w.start.z]}
      rotation={[0, angle, 0]}
    >
      {pieces
        .filter((p) => p.width > 0.005)
        .map((p, i) => (
          <mesh
            key={i}
            position={[p.x, p.y, 0]}
            castShadow
            receiveShadow
            onClick={(e) => {
              e.stopPropagation();
              if (transforming || performance.now() < ignoreClickUntil) return;
              const side = e.face?.materialIndex === 5 ? minus : plus;
              useStore.getState().selectWall(side.room.id, side.wallIndex);
            }}
          >
            <boxGeometry args={[p.width, p.height, w.thickness]} />
            {[0, 1, 2, 3, 4, 5].map((face) => {
              const style = face === 5 ? minusStyle : plusStyle;
              return (
                <meshStandardMaterial
                  key={face}
                  attach={`material-${face}`}
                  onUpdate={(material) => {
                    material.needsUpdate = true;
                  }}
                  color={style.color}
                  map={face === 4 ? plusMap : face === 5 ? minusMap : null}
                  roughness={style.roughness}
                  transparent={style.material === "glass"}
                  opacity={style.material === "glass" ? 0.45 : 1}
                  metalness={style.material === "metal" ? 0.65 : 0}
                />
              );
            })}
          </mesh>
        ))}
      <mesh position={[len / 2, 0.035, -0.065]}>
        <boxGeometry args={[len, 0.07, 0.025]} />
        <meshStandardMaterial color="#b4a087" />
      </mesh>
      {openings.map((o) => (
        <group
          key={o.id}
          position={[
            Math.min(len, o.offset + o.width / 2),
            o.sill + o.height / 2,
            0,
          ]}
        >
          {o.kind === "window" && (
            <>
              <mesh>
                <boxGeometry args={[o.width, o.height, 0.025]} />
                <meshStandardMaterial
                  color="#b8d5d4"
                  transparent
                  opacity={0.18}
                  roughness={0.15}
                />
              </mesh>
              {[-1, 1].map((n) => (
                <mesh key={n} position={[(n * o.width) / 2, 0, 0]}>
                  <boxGeometry args={[0.045, o.height, 0.1]} />
                  <PaintMaterial surface={openingSurface(o)} />
                </mesh>
              ))}
              <mesh>
                <boxGeometry args={[0.035, o.height, 0.07]} />
                <PaintMaterial surface={openingSurface(o)} />
              </mesh>
              <mesh>
                <boxGeometry args={[o.width, 0.04, 0.07]} />
                <PaintMaterial surface={openingSurface(o)} />
              </mesh>
            </>
          )}
          {o.kind === "door" && (
            <mesh
              position={[-o.width / 2 + 0.04, 0, o.width / 2]}
              rotation={[0, Math.PI / 2.2, 0]}
            >
              <boxGeometry args={[o.width, o.height, 0.04]} />
              <PaintMaterial surface={openingSurface(o)} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
function Item({ item: f }: { item: FurnitureItem }) {
  const selected = useStore((s) => s.selectedId === f.id),
    tool = useStore((s) => s.tool),
    walk = useStore((s) => s.view === "walk"),
    snap = useStore((s) => s.snap);
  const ref = useRef<THREE.Group>(null);
  const mode =
    tool === "rotate" ? "rotate" : tool === "scale" ? "scale" : "translate";
  const peer = useCoopStore((state) =>
    state.peers.find(
      (p) =>
        p.id !== state.clientId &&
        (p.editing === `furniture:${f.id}` || p.selectedId === f.id),
    ),
  );
  const canMove = useCoopStore(
    (state) =>
      !state.room ||
      (state.status === "connected" &&
        !state.peers.some(
          (p) =>
            p.id !== state.clientId &&
            (p.editing === `furniture:${f.id}` ||
              p.editing === `rooms:${f.roomId}`),
        )),
  );
  const active =
    selected && !walk && canMove && ["move", "rotate", "scale"].includes(tool);
  const start = useRef(f);
  return (
    <>
      <group
        ref={ref}
        position={[f.x, f.y, f.z]}
        rotation={[0, (f.rotation * Math.PI) / 180, 0]}
        onClick={(e) => {
          e.stopPropagation();
          if (transforming || performance.now() < ignoreClickUntil) return;
          useStore.setState({ selectedId: f.id, roomId: f.roomId });
        }}
      >
        <FurnitureModel item={f} />
        {(selected || peer) && !walk && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
            <planeGeometry args={[f.width + 0.1, f.depth + 0.1]} />
            <meshBasicMaterial
              color={peer?.color ?? "#829359"}
              transparent
              opacity={0.17}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>
      {active && (
        <TransformControls
          object={ref as React.RefObject<THREE.Object3D>}
          mode={mode}
          size={0.7}
          showY={mode !== "translate"}
          translationSnap={snap ? 0.1 : null}
          rotationSnap={snap ? Math.PI / 12 : null}
          scaleSnap={snap ? 0.1 : null}
          onMouseDown={() => {
            if (
              collaborationBridge.begin &&
              !collaborationBridge.begin(`furniture:${f.id}`)
            )
              return;
            transforming = true;
            start.current = f;
            useStore.getState().checkpoint();
          }}
          onObjectChange={() => {
            const g = ref.current;
            if (!g || !transforming) return;
            const valid = useStore
              .getState()
              .updateItem(
                f.id,
                {
                  x: g.position.x,
                  z: g.position.z,
                  y: g.position.y,
                  rotation: (g.rotation.y * 180) / Math.PI,
                  width: start.current.width * g.scale.x,
                  depth: start.current.depth * g.scale.z,
                  height: start.current.height * g.scale.y,
                },
                false,
              );
            g.scale.set(1, 1, 1);
            if (!valid) {
              const current = useStore
                .getState()
                .apartment.furniture.find((i) => i.id === f.id);
              if (current) {
                g.position.set(current.x, current.y, current.z);
                g.rotation.set(0, (current.rotation * Math.PI) / 180, 0);
              }
            }
          }}
          onMouseUp={() => {
            transforming = false;
            ignoreClickUntil = performance.now() + 200;
            ref.current?.scale.set(1, 1, 1);
            collaborationBridge.end?.();
          }}
        />
      )}
    </>
  );
}
function Walker() {
  const { camera, gl } = useThree();
  const roomId = useStore((s) => s.roomId);
  const keys = useRef(new Set<string>()),
    yaw = useRef(0),
    pitch = useRef(0),
    lastRoom = useRef("");
  useEffect(() => {
    if (lastRoom.current === roomId) return;
    lastRoom.current = roomId;
    const r = useStore.getState().apartment.rooms.find((r) => r.id === roomId)!;
    const b = bounds(r);
    const candidates = [];
    for (let x = b.minX + 0.25; x < b.maxX; x += 0.2)
      for (let z = b.minZ + 0.25; z < b.maxZ; z += 0.2)
        if (
          contains({ x, z }, r) &&
          walkable({ x, z }, useStore.getState().apartment, true)
        )
          candidates.push({ x, z });
    candidates.sort(
      (a, c) =>
        Math.hypot(a.x - (b.minX + b.maxX) / 2, a.z - (b.minZ + b.maxZ) / 2) -
        Math.hypot(c.x - (b.minX + b.maxX) / 2, c.z - (b.minZ + b.maxZ) / 2),
    );
    const start = candidates[0] || {
      x: (b.minX + b.maxX) / 2,
      z: (b.minZ + b.maxZ) / 2,
    };
    camera.position.set(start.x, 1.62, start.z);
    camera.rotation.order = "YXZ";
    camera.rotation.set(0, 0, 0);
    yaw.current = 0;
    pitch.current = 0;
  }, [roomId, camera]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
          return;
        keys.current.add(e.code);
        if (
          [
            "KeyW",
            "KeyA",
            "KeyS",
            "KeyD",
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
          ].includes(e.code)
        )
          e.preventDefault();
      },
      up = (e: KeyboardEvent) => keys.current.delete(e.code),
      blur = () => keys.current.clear(),
      move = (e: MouseEvent) => {
        if (e.buttons === 1 && e.target === gl.domElement) {
          yaw.current -= e.movementX * 0.004;
          pitch.current = THREE.MathUtils.clamp(
            pitch.current - e.movementY * 0.004,
            -1.2,
            1.2,
          );
        }
      };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("mousemove", move);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("mousemove", move);
    };
  }, [gl]);
  useFrame((_, dt) => {
    const k = keys.current;
    const forward =
        Number(k.has("KeyW") || k.has("ArrowUp")) -
        Number(k.has("KeyS") || k.has("ArrowDown")),
      side = Number(k.has("KeyD")) - Number(k.has("KeyA"));
    if (k.has("ArrowLeft")) yaw.current += dt;
    if (k.has("ArrowRight")) yaw.current -= dt;
    camera.rotation.set(pitch.current, yaw.current, 0);
    const n = {
      x:
        camera.position.x +
        (-Math.sin(yaw.current) * forward + Math.cos(yaw.current) * side) *
          Math.min(dt, 0.05) *
          1.8,
      z:
        camera.position.z +
        (-Math.cos(yaw.current) * forward - Math.sin(yaw.current) * side) *
          Math.min(dt, 0.05) *
          1.8,
    };
    const s = useStore.getState();
    if ((forward || side) && walkable(n, s.apartment, s.collisions)) {
      camera.position.set(n.x, 1.62, n.z);
      const next = s.apartment.rooms.find((r) => contains(n, r));
      if (next && next.id !== s.roomId) {
        lastRoom.current = next.id;
        useStore.setState({ roomId: next.id });
      }
    }
  });
  return null;
}
function World({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useEffect(() => {
    frames.current = 0;
  }, [onReady]);
  useFrame(() => {
    if (++frames.current === 4) onReady();
  });
  const a = useStore((s) => s.apartment),
    walk = useStore((s) => s.view === "walk"),
    grid = useStore((s) => s.grid),
    evening = useStore((s) => s.evening),
    visible = useStore((s) => s.furnitureVisible);
  return (
    <>
      <color attach="background" args={[evening ? "#44463f" : "#f4f0e8"]} />
      <ambientLight intensity={evening ? 0.4 : 0.7} />
      <hemisphereLight args={["#fff5de", "#8f9978", 0.8]} />
      <directionalLight
        position={[-3, 10, -5]}
        intensity={evening ? 0.3 : 2.4}
        color="#ffe5b2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.001}
        shadow-radius={4}
      />
      {a.rooms.map((r) => (
        <group key={r.id}>
          <Floor room={r} />
        </group>
      ))}
      {wallSegments(a).map((segment) => (
        <WallMesh key={segment.wall.id} {...segment} />
      ))}
      {visible && a.furniture.map((f) => <Item key={f.id} item={f} />)}
      {visible &&
        a.furniture
          .filter((f) => f.kind === "projector")
          .map((f) => <Projector key={f.id} item={f} apartment={a} />)}
      {grid && (
        <Grid
          position={[4.5, -0.13, 3.5]}
          args={[30, 30]}
          cellSize={0.1}
          sectionSize={1}
          cellColor="#b4b5a8"
          sectionColor="#969e85"
          fadeDistance={25}
        />
      )}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[4, -0.22, 3]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <shadowMaterial opacity={evening ? 0.22 : 0.12} />
      </mesh>
      {walk ? (
        <Walker />
      ) : (
        <OrbitControls
          key="orbit"
          makeDefault
          target={[4.4, 0, 3.3]}
          minDistance={3}
          maxDistance={35}
          maxPolarAngle={Math.PI / 2.05}
          enableDamping
        />
      )}
    </>
  );
}
export default function SceneEditor() {
  const tool = useStore((s) => s.tool);
  const [readyTool, setReadyTool] = useState<string | null>(null);
  const ready = readyTool === tool;
  const markReady = useCallback(() => setReadyTool(tool), [tool]);
  const view = useStore((s) => s.view);
  return (
    <div className="scene-editor" aria-busy={!ready} data-ready={ready}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, 1.6]}
        camera={{ position: [-5, 11, -7], fov: 39, near: 0.05, far: 100 }}
        onPointerMissed={() => {
          if (!transforming && performance.now() > ignoreClickUntil)
            useStore.getState().select(null);
        }}
      >
        <World onReady={markReady} />
      </Canvas>
      <div className="canvas-caption">
        {view === "walk" ? "WALK THROUGH" : "3D VIEW"}
        <span>
          {view === "walk"
            ? "WASD: move · drag: look around · choose a room on the left"
            : "Drag: orbit · scroll: zoom · right-drag: pan"}
        </span>
      </div>
    </div>
  );
}
