import { useState } from "react";
import type { Room } from "../model/types";
import { floorSurface, wallSurface } from "../model/surfaces";
import { useStore } from "../model/store";
import AppearanceEditor from "./AppearanceEditor";
export default function RoomSurfaces({ room }: { room: Room }) {
  const s = useStore(),
    [target, setTarget] = useState("floor"),
    selected = s.selectedWall?.roomId === room.id ? s.selectedWall.index : null;
  const active = selected === null ? target : `wall-${selected}`;
  const wallIndex = active.startsWith("wall-")
    ? Number(active.slice(5))
    : undefined;
  const value =
    active === "floor" ? floorSurface(room) : wallSurface(room, wallIndex);
  return (
    <section className="room-surfaces">
      <h3>Room finishes</h3>
      <label className="appearance-label">
        Choose surface
        <select
          aria-label="Surface target"
          value={active}
          onChange={(e) => {
            setTarget(e.target.value);
            if (e.target.value.startsWith("wall-"))
              s.selectWall(room.id, Number(e.target.value.slice(5)));
            else useStore.setState({ selectedWall: null });
          }}
        >
          <option value="floor">Floor</option>
          <option value="walls">All walls</option>
          {room.points.map((_, i) => (
            <option key={i} value={`wall-${i}`}>
              Wall {i + 1}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">
        Click a wall in 2D or 3D to edit its room-facing finish. Shared walls
        can have different finishes on each side.
      </p>
      <AppearanceEditor
        key={`${room.id}-${active}`}
        value={value}
        onChange={(surface) =>
          s.updateRoomSurface(
            room.id,
            active === "floor"
              ? "floor"
              : active === "walls"
                ? "walls"
                : wallIndex!,
            surface,
          )
        }
      />
      {wallIndex !== undefined && (
        <div className="wall-surface-actions">
          <button onClick={() => s.updateRoomSurface(room.id, "walls", value)}>
            Apply to all walls
          </button>
          {room.wallSurfaces?.[wallIndex] && (
            <button
              onClick={() =>
                s.change((a) => {
                  const r = a.rooms.find((r) => r.id === room.id)!;
                  delete r.wallSurfaces?.[wallIndex];
                })
              }
            >
              Use room default
            </button>
          )}
        </div>
      )}
      {active === "walls" && (
        <p className="texture-help">
          Changes to All walls also replace individual wall overrides in this
          room.
        </p>
      )}
    </section>
  );
}
