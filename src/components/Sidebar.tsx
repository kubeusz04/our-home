import { useState } from "react";
import {
  Box,
  LayoutTemplate,
  Footprints,
  Plus,
  Sofa,
  Utensils,
  BedDouble,
  Monitor,
  Bath,
  DoorOpen,
  Flower2,
  MousePointer2,
  Move,
  RotateCw,
  Maximize,
  CornerUpLeft,
  PanelTop,
  Grid2X2,
} from "lucide-react";
import { useStore } from "../model/store";
import { area } from "../model/geometry";
const icons = [Sofa, Utensils, BedDouble, Monitor, Bath, DoorOpen, Flower2];
export default function Sidebar() {
  const s = useStore(),
    [adding, setAdding] = useState(false);
  return (
    <aside className="sidebar">
      <div className="side-heading">
        <h2>Rooms</h2>
        <button
          className="icon-button"
          title="Add room"
          onClick={() => setAdding(!adding)}
        >
          <Plus size={18} />
        </button>
      </div>
      {adding && (
        <form
          className="add-room"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            s.addRoom(
              String(d.get("name")),
              Number(d.get("width")),
              Number(d.get("depth")),
            );
            setAdding(false);
          }}
        >
          <input name="name" placeholder="Room name" required />
          <div className="inline">
            <input
              name="width"
              aria-label="New room width"
              type="number"
              min="1"
              max="20"
              step=".1"
              defaultValue="3"
            />
            <span>×</span>
            <input
              name="depth"
              aria-label="New room depth"
              type="number"
              min="1"
              max="20"
              step=".1"
              defaultValue="3"
            />
            <span>m</span>
          </div>
          <button className="primary" type="submit">
            Create room
          </button>
        </form>
      )}
      <div className="room-list">
        {s.apartment.rooms.map((r, i) => {
          const Icon = icons[i % icons.length];
          return (
            <button
              key={r.id}
              className={`room-row ${s.roomId === r.id ? "active" : ""}`}
              onClick={() =>
                useStore.setState({
                  roomId: r.id,
                  selectedId: null,
                  selectedWall: null,
                })
              }
            >
              <Icon size={21} strokeWidth={1.5} />
              <span>
                <strong>{r.name}</strong>
                <small>{area(r).toFixed(1)} m²</small>
              </span>
              <span className="room-dot" />
            </button>
          );
        })}
      </div>
      <section className="side-section">
        <h3>View</h3>
        <div className="view-switch">
          {(
            [
              { id: "3d", label: "3D view", icon: Box },
              { id: "2d", label: "2D plan", icon: LayoutTemplate },
              { id: "walk", label: "Walk", icon: Footprints },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              className={s.view === v.id ? "active" : ""}
              onClick={() => useStore.setState({ view: v.id })}
            >
              <v.icon size={20} strokeWidth={1.5} />
              <span>{v.label}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="side-section">
        <h3>Tools</h3>
        <div className="tools-grid">
          {(
            [
              { id: "select", label: "Select", icon: MousePointer2 },
              { id: "move", label: "Move", icon: Move },
              { id: "rotate", label: "Rotate", icon: RotateCw },
              { id: "scale", label: "Scale", icon: Maximize },
              { id: "corners", label: "Outline", icon: CornerUpLeft },
              { id: "room-move", label: "Move room", icon: Move },
              { id: "door", label: "Door", icon: DoorOpen },
              { id: "window", label: "Window", icon: PanelTop },
              { id: "passage", label: "Opening", icon: Grid2X2 },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              className={s.tool === t.id ? "active" : ""}
              onClick={() =>
                useStore.setState({
                  tool: t.id,
                  ...(t.id === "room-move"
                    ? { selectedId: null, selectedWall: null }
                    : {}),
                  ...([
                    "corners",
                    "room-move",
                    "door",
                    "window",
                    "passage",
                  ].includes(t.id)
                    ? { view: "2d" as const }
                    : {}),
                })
              }
            >
              <t.icon size={19} strokeWidth={1.5} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="side-section">
        <h3>Layers & guides</h3>
        {(
          [
            { key: "dimensions", label: "Dimensions" },
            { key: "grid", label: "Grid" },
            { key: "snap", label: "Snap to 10 cm" },
            { key: "showWalls", label: "Walls" },
            { key: "furnitureVisible", label: "Furniture" },
            { key: "collisions", label: "Avoid collisions" },
          ] as const
        ).map((o) => (
          <label className="check-row" key={o.key}>
            <input
              type="checkbox"
              checked={s[o.key]}
              onChange={(e) => useStore.setState({ [o.key]: e.target.checked })}
            />
            {o.label}
          </label>
        ))}
      </section>
      <div className="side-footer">
        <Flower2 size={18} />
        <p>
          Room for our tomorrow.<small>Our shared project</small>
        </p>
      </div>
    </aside>
  );
}
