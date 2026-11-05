import { collaborationBridge } from "../collab/bridge";
import { useCoopStore } from "../collab/client";
import { randomId } from "../model/id";
import { wallSurface, openingSurface } from "../model/surfaces";
import { useRef, useState, useEffect, useMemo } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useStore } from "../model/store";
import {
  area,
  bounds,
  snapValue,
  walls,
  wallSegments,
} from "../model/geometry";
import type { FurnitureItem, Vec2 } from "../model/types";
import { PlanSymbol } from "../components/PlanSymbol";
import { Plus, Minus, Maximize } from "lucide-react";
type Drag =
  | {
      type: "furniture";
      id: string;
      offset: Vec2;
      start: Vec2;
      original: FurnitureItem;
    }
  | { type: "corner"; roomId: string; index: number }
  | { type: "wall"; roomId: string; index: number; start: Vec2; points: Vec2[] }
  | { type: "room"; roomId: string; start: Vec2; x: number; z: number }
  | { type: "pan"; start: Vec2; pan: Vec2 };
export default function PlanEditor() {
  const peers = useCoopStore((state) => state.peers),
    myId = useCoopStore((state) => state.clientId);
  const s = useStore(),
    svg = useRef<SVGSVGElement>(null),
    drag = useRef<Drag | null>(null);
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, z: 0 });
  const wallHits = useMemo(() => wallSegments(s.apartment), [s.apartment]);
  const ps = s.apartment.rooms.flatMap((r) => r.points);
  const minX = Math.min(...ps.map((p) => p.x)) - 0.7,
    minZ = Math.min(...ps.map((p) => p.z)) - 0.7;
  const width = Math.max(10.5, Math.max(...ps.map((p) => p.x)) - minX + 0.8),
    height = Math.max(11, Math.max(...ps.map((p) => p.z)) - minZ + 0.8);
  const [frozenView, setFrozenView] = useState<{
    x: number;
    z: number;
    w: number;
    h: number;
  } | null>(null);
  const vb = frozenView ?? {
    x: minX + pan.x,
    z: minZ + pan.z,
    w: width / zoom,
    h: height / zoom,
  };
  useEffect(() => {
    const node = svg.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) =>
        Math.max(0.5, Math.min(4, z * (e.deltaY < 0 ? 1.1 : 0.9))),
      );
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, []);
  function point(e: ReactPointerEvent) {
    const p = svg.current!.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return { x: q.x, z: q.y };
  }
  function begin(e: ReactPointerEvent, d: Drag) {
    e.stopPropagation();
    if (d.type !== "pan") {
      const key =
        d.type === "furniture" ? `furniture:${d.id}` : `rooms:${d.roomId}`;
      if (collaborationBridge.begin && !collaborationBridge.begin(key)) return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (d.type === "room") setFrozenView(vb);
    if (d.type !== "pan") s.checkpoint();
    drag.current = d;
  }
  function move(e: ReactPointerEvent) {
    const d = drag.current;
    const p = point(e);
    collaborationBridge.cursor?.(p);
    if (!d) return;
    if (d.type === "pan") {
      setPan({
        x:
          d.pan.x +
          (d.start.x - e.clientX) * svg.current!.getScreenCTM()!.inverse().a,
        z:
          d.pan.z +
          (d.start.z - e.clientY) * svg.current!.getScreenCTM()!.inverse().d,
      });
      return;
    }
    if (d.type === "room") {
      s.transformRoom(
        d.roomId,
        {
          x: snapValue(d.x + p.x - d.start.x, s.snap),
          z: snapValue(d.z + p.z - d.start.z, s.snap),
        },
        false,
      );
      return;
    }
    if (d.type === "corner") {
      const r = s.apartment.rooms.find((r) => r.id === d.roomId)!;
      s.updateRoom(
        r.id,
        {
          points: r.points.map((q, i) =>
            i === d.index
              ? { x: snapValue(p.x, s.snap), z: snapValue(p.z, s.snap) }
              : q,
          ),
        },
        false,
      );
    } else if (d.type === "wall") {
      const dx = snapValue(p.x - d.start.x, s.snap),
        dz = snapValue(p.z - d.start.z, s.snap);
      s.updateRoom(
        d.roomId,
        {
          points: d.points.map((q, i) =>
            i === d.index || i === (d.index + 1) % d.points.length
              ? { x: q.x + dx, z: q.z + dz }
              : q,
          ),
        },
        false,
      );
    } else {
      if (s.tool === "rotate") {
        const angle =
          (Math.atan2(p.z - d.original.z, p.x - d.original.x) * 180) / Math.PI;
        s.updateItem(d.id, { rotation: Math.round(angle / 15) * 15 }, false);
      } else if (s.tool === "scale") {
        const factor = Math.max(
          0.1,
          Math.hypot(p.x - d.original.x, p.z - d.original.z) /
            Math.max(
              0.1,
              Math.hypot(d.start.x - d.original.x, d.start.z - d.original.z),
            ),
        );
        s.updateItem(
          d.id,
          {
            width: Math.round(d.original.width * factor * 100) / 100,
            depth: Math.round(d.original.depth * factor * 100) / 100,
          },
          false,
        );
      } else
        s.updateItem(
          d.id,
          {
            x: snapValue(p.x - d.offset.x, s.snap),
            z: snapValue(p.z - d.offset.z, s.snap),
          },
          false,
        );
    }
  }
  return (
    <div className="plan-editor">
      <svg
        ref={svg}
        role="application"
        aria-label="Editable apartment plan"
        viewBox={`${vb.x} ${vb.z} ${vb.w} ${vb.h}`}
        onPointerMove={move}
        onPointerUp={(e) => {
          collaborationBridge.end?.();
          drag.current = null;
          setFrozenView(null);
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          collaborationBridge.end?.();
          drag.current = null;
          setFrozenView(null);
        }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            s.select(null);
            begin(e, {
              type: "pan",
              start: { x: e.clientX, z: e.clientY },
              pan,
            });
          }
        }}
      >
        <defs>
          <pattern
            id="plan-grid"
            width=".1"
            height=".1"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M.1 0H0V.1"
              fill="none"
              stroke="#c5c7bc"
              strokeWidth=".007"
            />
          </pattern>
          <pattern
            id="floor-wood"
            width=".22"
            height="1.4"
            patternUnits="userSpaceOnUse"
          >
            <rect width=".22" height="1.4" fill="#ddc7a5" />
            <path d="M0 0V1.4M0 0H.22" stroke="#bda481" strokeWidth=".008" />
          </pattern>
        </defs>
        {s.grid && (
          <rect
            x={vb.x}
            y={vb.z}
            width={vb.w}
            height={vb.h}
            fill="url(#plan-grid)"
            pointerEvents="none"
          />
        )}
        {s.apartment.rooms.map((r) => {
          const b = bounds(r),
            active = r.id === s.roomId;
          return (
            <g key={r.id}>
              <polygon
                data-testid={`room-floor-${r.id}`}
                points={r.points.map((p) => `${p.x},${p.z}`).join(" ")}
                fill={r.color}
                fillOpacity={active ? ".85" : ".5"}
                stroke={active ? "#7e895b" : "#a29a89"}
                strokeWidth=".035"
                onPointerDown={(e) => {
                  if (s.tool === "room-move") {
                    useStore.setState({
                      roomId: r.id,
                      selectedId: null,
                      selectedWall: null,
                    });
                    begin(e, {
                      type: "room",
                      roomId: r.id,
                      start: point(e),
                      x: b.minX,
                      z: b.minZ,
                    });
                  }
                }}
                onClick={() =>
                  useStore.setState({ roomId: r.id, selectedId: null })
                }
              />
              <text
                x={(b.minX + b.maxX) / 2}
                y={b.minZ + 0.35}
                textAnchor="middle"
                className="room-label"
              >
                {r.name}
              </text>
              <text
                x={(b.minX + b.maxX) / 2}
                y={b.minZ + 0.58}
                textAnchor="middle"
                className="area-label"
              >
                {area(r).toFixed(1)} m²
              </text>
              {walls(r).map((w, i) => {
                const len = Math.hypot(
                  w.end.x - w.start.x,
                  w.end.z - w.start.z,
                );
                return (
                  <g key={w.id}>
                    <line
                      x1={w.start.x}
                      y1={w.start.z}
                      x2={w.end.x}
                      y2={w.end.z}
                      stroke="#817c6b"
                      strokeWidth={s.showWalls ? 0.17 : 0.04}
                      pointerEvents="none"
                    />
                    <line
                      x1={w.start.x}
                      y1={w.start.z}
                      x2={w.end.x}
                      y2={w.end.z}
                      stroke={
                        s.selectedWall?.roomId === r.id &&
                        s.selectedWall.index === i
                          ? "#73894e"
                          : wallSurface(r, i).color
                      }
                      strokeWidth={s.showWalls ? 0.12 : 0.02}
                    />
                    <line
                      x1={w.start.x}
                      y1={w.start.z}
                      x2={w.end.x}
                      y2={w.end.z}
                      stroke="transparent"
                      strokeWidth=".22"
                      className="wall-hit"

                      onClick={(e) => {
                        e.stopPropagation();
                        if (s.tool === "select") s.selectWall(r.id, i);
                      }}
                      onPointerDown={(e) => {
                        if (["door", "window", "passage"].includes(s.tool)) {
                          const p = point(e),
                            t = Math.max(
                              0,
                              Math.min(
                                len - 0.9,
                                ((p.x - w.start.x) * (w.end.x - w.start.x) +
                                  (p.z - w.start.z) * (w.end.z - w.start.z)) /
                                  len -
                                  0.45,
                              ),
                            );
                          s.change((a) =>
                            a.openings.push({
                              id: randomId(),
                              roomId: r.id,
                              wallIndex: i,
                              kind: s.tool as "door" | "window" | "passage",
                              offset: t,
                              width: 0.9,
                              height: s.tool === "window" ? 1.3 : 2.15,
                              sill: s.tool === "window" ? 0.9 : 0,
                            }),
                          );
                          e.stopPropagation();
                        } else if (s.tool === "corners")
                          begin(e, {
                            type: "wall",
                            roomId: r.id,
                            index: i,
                            start: point(e),
                            points: structuredClone(r.points),
                          });
                      }}
                    />
                    {s.dimensions && (
                      <text
                        x={(w.start.x + w.end.x) / 2}
                        y={(w.start.z + w.end.z) / 2 - 0.13}
                        textAnchor="middle"
                        className="dimension-label"
                      >
                        {len.toFixed(2)} m
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        {s.apartment.openings.map((o) => {
          const r = s.apartment.rooms.find((r) => r.id === o.roomId)!;
          const w = walls(r)[o.wallIndex];
          if (!w) return null;
          const len = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z),
            angle =
              (Math.atan2(w.end.z - w.start.z, w.end.x - w.start.x) * 180) /
              Math.PI;
          return (
            <g
              key={o.id}
              pointerEvents={s.tool === "room-move" ? "none" : undefined}
              data-testid={`opening-${o.id}`}
              transform={`translate(${w.start.x} ${w.start.z}) rotate(${angle}) translate(${o.offset} 0)`}
              onClick={(e) => {
                e.stopPropagation();
                s.select(o.id);
              }}
              style={{ cursor: "pointer" }}
            >
              <rect
                x="0"
                y="-.07"
                width={Math.min(o.width, len - o.offset)}
                height=".14"
                fill={
                  o.surface
                    ? openingSurface(o).color
                    : o.kind === "window"
                      ? "#aec5c2"
                      : "#f5f1e9"
                }
                stroke={s.selectedId === o.id ? "#6d7d45" : "#829a97"}
                strokeWidth=".025"
              />
              {o.kind === "door" && (
                <path
                  d={`M0 0V${o.width}A${o.width} ${o.width} 0 0 0 ${o.width} 0`}
                  fill="none"
                  stroke="#9a8871"
                  strokeWidth=".015"
                />
              )}
            </g>
          );
        })}
        {s.furnitureVisible &&
          [...s.apartment.furniture]
            .sort((a, b) => a.y - b.y || (a.kind === "rug" ? -1 : 1))
            .map((f) => (
              <g
                key={f.id}
                data-testid={`plan-${f.id}`}
                aria-label={f.name}
                transform={`translate(${f.x} ${f.z}) rotate(${f.rotation})`}
                onPointerDown={(e) => {
                  s.select(f.id);
                  useStore.setState({ roomId: f.roomId });
                  begin(e, {
                    type: "furniture",
                    id: f.id,
                    offset: { x: point(e).x - f.x, z: point(e).z - f.z },
                    start: point(e),
                    original: f,
                  });
                }}
                className="furniture-plan"
                pointerEvents={s.tool === "room-move" ? "none" : undefined}
              >
                <rect
                  x={-f.width / 2}
                  y={-f.depth / 2}
                  width={f.width}
                  height={f.depth}
                  rx=".05"
                  fill={f.color}
                  fillOpacity={f.kind === "rug" ? ".5" : ".95"}
                  stroke={s.selectedId === f.id ? "#657c42" : "#9a8d78"}
                  strokeWidth={s.selectedId === f.id ? 0.045 : 0.015}
                />
                {f.kind !== "rug" && (
                  <PlanSymbol
                    kind={f.kind}
                    color={f.color}
                    x={-f.width / 2}
                    y={-f.depth / 2}
                    width={f.width}
                    height={f.depth}
                  />
                )}
                {s.selectedId === f.id && (
                  <circle
                    cx={f.width / 2}
                    cy={f.depth / 2}
                    r=".055"
                    fill="#fff"
                    stroke="#647844"
                    strokeWidth=".02"
                  />
                )}
              </g>
            ))}
        {peers
          .filter((p) => p.id !== myId)
          .map((peer) => {
            const item = s.apartment.furniture.find(
              (f) =>
                f.id ===
                (peer.editing?.startsWith("furniture:")
                  ? peer.editing.slice(10)
                  : peer.selectedId),
            );
            return (
              <g key={peer.id} pointerEvents="none">
                {item && (
                  <g
                    transform={`translate(${item.x} ${item.z}) rotate(${item.rotation})`}
                  >
                    <rect
                      x={-item.width / 2 - 0.06}
                      y={-item.depth / 2 - 0.06}
                      width={item.width + 0.12}
                      height={item.depth + 0.12}
                      fill="none"
                      stroke={peer.color}
                      strokeWidth=".035"
                      strokeDasharray={peer.editing ? undefined : ".1 .05"}
                    />
                    <text
                      x={-item.width / 2}
                      y={-item.depth / 2 - 0.14}
                      fill={peer.color}
                      className="peer-plan-label"
                    >
                      {peer.name}
                      {peer.editing ? " · editing" : ""}
                    </text>
                  </g>
                )}
                {peer.cursor && (
                  <g transform={`translate(${peer.cursor.x} ${peer.cursor.z})`}>
                    <path
                      d="M0 0 .08 .24 .13 .13 .24 .08Z"
                      fill={peer.color}
                      stroke="#fff"
                      strokeWidth=".01"
                    />
                    <text
                      x=".25"
                      y=".22"
                      fill={peer.color}
                      className="peer-plan-label"
                    >
                      {peer.name}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        {s.tool === "select" &&
          s.apartment.rooms
            .filter((r) => r.id === s.roomId)
            .flatMap((r) =>
              walls(r).flatMap((w, i) =>
                wallHits
                  .filter(
                    (segment) =>
                      !segment.openings.length &&
                      segment.sides.some(
                        (side) => side.room.id === r.id && side.wallIndex === i,
                      ),
                  )
                  .map((segment, part) => {
                    const start = segment.wall.start,
                      end = segment.wall.end,
                      length = Math.hypot(end.x - start.x, end.z - start.z),
                      angle =
                        (Math.atan2(end.z - start.z, end.x - start.x) * 180) /
                        Math.PI;
                    return (
                      <g
                        key={w.id + "-select-" + part}
                        transform={`translate(${start.x} ${start.z}) rotate(${angle})`}
                      >
                        <rect
                          data-testid={
                            part === 0 ? `wall-${r.id}-${i}` : undefined
                          }
                          className="wall-select-hit"
                          role="button"
                          aria-label={`Edit ${r.name} wall ${i + 1}`}
                          tabIndex={part === 0 ? 0 : -1}
                          x={Math.min(0.03, length * 0.2)}
                          y={-0.1}
                          width={Math.max(
                            0.001,
                            length - 2 * Math.min(0.03, length * 0.2),
                          )}
                          height={0.2}
                          fill="transparent"
                          onClick={(e) => {
                            e.stopPropagation();
                            s.selectWall(r.id, i);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              s.selectWall(r.id, i);
                            }
                          }}
                        >
                          <title>
                            {r.name} · Wall {i + 1}
                          </title>
                        </rect>
                      </g>
                    );
                  }),
              ),
            )}
        {s.tool === "corners" &&
          s.apartment.rooms
            .filter((r) => r.id === s.roomId)
            .flatMap((r) =>
              r.points.map((p, i) => (
                <circle
                  key={r.id + i}
                  className="corner-handle"
                  data-testid={`corner-${r.id}-${i}`}
                  cx={p.x}
                  cy={p.z}
                  r=".09"
                  fill="#fff"
                  stroke="#677747"
                  strokeWidth=".03"
                  onPointerDown={(e) =>
                    begin(e, { type: "corner", roomId: r.id, index: i })
                  }
                />
              )),
            )}
      </svg>
      <div className="zoom-controls">
        <button
          title="Zoom in"
          onClick={() => setZoom((z) => Math.min(4, z * 1.2))}
        >
          <Plus size={17} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          title="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.5, z / 1.2))}
        >
          <Minus size={17} />
        </button>
        <button
          title="Fit plan"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, z: 0 });
          }}
        >
          <Maximize size={16} />
        </button>
      </div>
      <div className="canvas-caption">
        2D PLAN <span>Units: metres · 10 cm grid</span>
      </div>
    </div>
  );
}
