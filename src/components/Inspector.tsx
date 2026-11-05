import AppearanceEditor from "./AppearanceEditor";
import RoomSurfaces from "./RoomSurfaces";
import { itemSurface, openingSurface } from "../model/surfaces";
import { useState, useRef, useEffect } from "react";
import { money } from "../model/format";
import { Copy, Trash2, Sofa, ChevronDown } from "lucide-react";
import { useStore } from "../model/store";
import { bounds, walls } from "../model/geometry";
import { NumberField, Section } from "./Fields";
import { PlanSymbol } from "./PlanSymbol";
import type { FurnitureItem } from "../model/types";
export default function Inspector() {
  const [scaleContents, setScaleContents] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  const s = useStore(),
    f = s.apartment.furniture.find((f) => f.id === s.selectedId),
    o = s.apartment.openings.find((o) => o.id === s.selectedId),
    room = s.apartment.rooms.find((r) => r.id === s.roomId)!,
    b = bounds(room);
  const roomTab = s.roomInspectorTab;
  const setRoomTab = (roomInspectorTab: "layout" | "surfaces") =>
    useStore.setState({ roomInspectorTab });
  const update = (p: Partial<FurnitureItem>) => f && s.updateItem(f.id, p);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [f?.id, o?.id, s.roomId, roomTab, s.selectedWall?.index]);
  return (
    <aside className="inspector">
      {f ? (
        <>
          <div className="inspector-head">
            <div className="object-preview">
              <PlanSymbol kind={f.kind} color={f.color} />
            </div>
            <div>
              <span className="eyebrow">SELECTED ITEM</span>
              <h2>{f.name}</h2>
              <small>
                {s.apartment.rooms.find((r) => r.id === f.roomId)?.name}
              </small>
            </div>
          </div>
          <div className="inspector-tab">
            <Sofa size={16} /> Item properties{" "}
            <button
              className="text-button edit-room-link"
              onClick={() => s.select(null)}
            >
              Edit room
            </button>
            <ChevronDown size={14} />
          </div>
          <div ref={bodyRef} className="inspector-body">
            <Section title="Name & room">
              <input
                aria-label="Item name"
                value={f.name}
                onChange={(e) => update({ name: e.target.value })}
              />
              <select
                aria-label="Item room"
                value={f.roomId}
                onChange={(e) => {
                  const r = s.apartment.rooms.find(
                      (r) => r.id === e.target.value,
                    )!,
                    b = bounds(r);
                  if (
                    s.updateItem(f.id, {
                      roomId: r.id,
                      x: (b.minX + b.maxX) / 2,
                      z: (b.minZ + b.maxZ) / 2,
                    })
                  )
                    useStore.setState({ roomId: r.id });
                }}
              >
                {s.apartment.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Section>
            <Section title="Dimensions">
              <NumberField
                label="Width"
                value={f.width}
                onChange={(v) => update({ width: v })}
                min={0.02}
              />
              <NumberField
                label="Depth"
                value={f.depth}
                onChange={(v) => update({ depth: v })}
                min={0.02}
              />
              <NumberField
                label="Height"
                value={f.height}
                onChange={(v) => update({ height: v })}
                min={0.02}
              />
            </Section>
            <Section title="Position in project">
              <div className="coordinate-fields">
                <NumberField
                  label="X"
                  value={f.x}
                  onChange={(v) => update({ x: v })}
                />
                <NumberField
                  label="Z"
                  value={f.z}
                  onChange={(v) => update({ z: v })}
                />
              </div>
              <NumberField
                label="Above floor"
                value={f.y}
                onChange={(v) => update({ y: v })}
                min={0}
              />
              <NumberField
                label="Rotation"
                value={f.rotation}
                onChange={(v) => update({ rotation: v })}
                step={15}
                unit="°"
              />
            </Section>
            <Section title="Colour & material">
              <AppearanceEditor
                key={f.id}
                value={itemSurface(f)}
                onChange={(surface) => update({ surface })}
              />
              {f.kind.startsWith("freesia") && (
                <label className="field">
                  <span>Vase</span>
                  <select
                    aria-label="Freesia vase"
                    value={f.vase}
                    onChange={(e) =>
                      update({ vase: e.target.value as FurnitureItem["vase"] })
                    }
                  >
                    <option>ceramic</option>
                    <option>glass</option>
                    <option>slim</option>
                  </select>
                </label>
              )}
              {f.kind === "projector" && (
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    onChange={(e) => update({ enabled: e.target.checked })}
                  />
                  Enable projection
                </label>
              )}
            </Section>
            <Section title="Purchase & notes">
              <NumberField
                label="Estimated cost"
                value={f.cost}
                onChange={(v) => update({ cost: v })}
                unit="₩"
                step={1000}
                min={0}
              />
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={f.purchased}
                  onChange={(e) => update({ purchased: e.target.checked })}
                />
                Purchased
              </label>
              <textarea
                aria-label="Item notes"
                placeholder="An idea, a shop link, something for us…"
                value={f.notes}
                onChange={(e) => update({ notes: e.target.value })}
              />
              <small>Enter your own prices. KRW 0 means not priced yet.</small>
            </Section>
            <div className="item-cost">
              <span>Estimated cost</span>
              <strong>{money(f.cost)}</strong>
            </div>
          </div>
          <div className="inspector-actions">
            <button onClick={() => s.duplicate(f.id)}>
              <Copy size={16} />
              Duplicate
            </button>
            <button className="danger" onClick={() => s.removeItem(f.id)}>
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </>
      ) : o ? (
        <>
          <div className="panel-title">
            <h2>
              {o.kind === "door"
                ? "Door"
                : o.kind === "window"
                  ? "Window"
                  : "Opening"}
            </h2>
            <p>Edit a wall opening</p>
          </div>
          <div ref={bodyRef} className="inspector-body">
            <Section title="Opening dimensions">
              {(["offset", "width", "height", "sill"] as const).map(
                (key, i) => (
                  <NumberField
                    key={key}
                    label={
                      [
                        "Offset along wall",
                        "Opening width",
                        "Opening height",
                        "Sill height",
                      ][i]
                    }
                    value={o[key]}
                    onChange={(v) => {
                      const r = s.apartment.rooms.find(
                          (r) => r.id === o.roomId,
                        )!,
                        w = walls(r)[o.wallIndex],
                        len = Math.hypot(
                          w.end.x - w.start.x,
                          w.end.z - w.start.z,
                        ),
                        n = { ...o, [key]: v };
                      if (
                        n.width <= 0 ||
                        n.offset < 0 ||
                        n.offset + n.width > len ||
                        n.sill < 0 ||
                        n.height <= 0 ||
                        n.sill + n.height > 2.7
                      ) {
                        s.notify("The opening must fit inside the wall.");
                        return;
                      }
                      s.change((a) => {
                        a.openings = a.openings.map((x) =>
                          x.id === o.id ? n : x,
                        );
                      });
                    }}
                  />
                ),
              )}
            </Section>
            <Section title="Opening finish">
              <AppearanceEditor
                key={o.id}
                value={openingSurface(o)}
                onChange={(surface) =>
                  s.change((a) => {
                    a.openings = a.openings.map((item) =>
                      item.id === o.id ? { ...item, surface } : item,
                    );
                  })
                }
              />
            </Section>
            <button
              className="danger"
              onClick={() => {
                s.change((a) => {
                  a.openings = a.openings.filter((x) => x.id !== o.id);
                });
                s.select(null);
              }}
            >
              <Trash2 size={16} />
              Delete opening
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="panel-title">
            <span className="eyebrow">OUR SPACE</span>
            <h2>{room.name}</h2>
            <p>Room properties</p>
          </div>
          <div className="room-inspector-tabs">
            <button
              className={
                s.selectedWall?.roomId !== room.id && roomTab === "layout"
                  ? "active"
                  : ""
              }
              onClick={() => {
                useStore.setState({ selectedWall: null });
                setRoomTab("layout");
              }}
            >
              Layout
            </button>
            <button
              className={
                s.selectedWall?.roomId === room.id || roomTab === "surfaces"
                  ? "active"
                  : ""
              }
              onClick={() => setRoomTab("surfaces")}
            >
              Surfaces
            </button>
          </div>
          <div ref={bodyRef} className="inspector-body">
            {s.selectedWall?.roomId === room.id || roomTab === "surfaces" ? (
              <RoomSurfaces key={room.id} room={room} />
            ) : (
              <>
                <Section title="Room">
                  <label>
                    Name
                    <input
                      aria-label="Room name"
                      value={room.name}
                      onChange={(e) =>
                        s.updateRoom(room.id, { name: e.target.value })
                      }
                    />
                  </label>
                  <NumberField
                    label="Room width"
                    value={b.maxX - b.minX}
                    min={1}
                    max={20}
                    onChange={(v) =>
                      s.transformRoom(room.id, { width: v, scaleContents })
                    }
                  />
                  <NumberField
                    label="Room depth"
                    value={b.maxZ - b.minZ}
                    min={1}
                    max={20}
                    onChange={(v) =>
                      s.transformRoom(room.id, { depth: v, scaleContents })
                    }
                  />
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={scaleContents}
                      onChange={(e) => setScaleContents(e.target.checked)}
                    />
                    Scale furniture with room
                  </label>
                  <p className="muted">
                    Enter a value and press Enter, or click outside the field,
                    to apply.
                  </p>
                </Section>
                <Section title="Room position">
                  <NumberField
                    label="Room X"
                    value={b.minX}
                    onChange={(v) => s.transformRoom(room.id, { x: v })}
                  />
                  <NumberField
                    label="Room Z"
                    value={b.minZ}
                    onChange={(v) => s.transformRoom(room.id, { z: v })}
                  />
                  <button
                    className="move-room-button"
                    onClick={() =>
                      useStore.setState({
                        view: "2d",
                        tool: "room-move",
                        selectedId: null,
                      })
                    }
                  >
                    Move room in 2D
                  </button>
                  <p className="muted">
                    X and Z locate the room’s top-left corner in metres.
                    Furniture and openings move with it.
                  </p>
                  <label className="field">
                    Floor colour
                    <input
                      aria-label="Floor colour"
                      type="color"
                      value={room.color}
                      onChange={(e) =>
                        s.updateRoom(room.id, { color: e.target.value })
                      }
                    />
                  </label>
                </Section>
                <Section title="Our ideas">
                  <textarea
                    aria-label="Room notes"
                    placeholder="What would make this room feel like home?"
                    value={room.notes}
                    onChange={(e) =>
                      s.updateRoom(room.id, { notes: e.target.value })
                    }
                  />
                </Section>
                <Section title="Edit outline">
                  <p className="muted">
                    In the 2D plan, choose Outline to drag corners or walls.
                    Choose Door, Window or Opening, then click a wall.
                  </p>
                </Section>
                <button
                  className="danger"
                  onClick={() => {
                    if (
                      confirm(
                        `Delete room “${room.name}” and all its contents?`,
                      )
                    )
                      s.deleteRoom(room.id);
                  }}
                >
                  <Trash2 size={16} />
                  Delete room
                </button>
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
