import { useStore } from "../model/store";
import { bounds } from "../model/geometry";
import { footprint } from "../model/geometry";
export default function RoomStrip() {
  const rooms = useStore((s) => s.apartment.rooms),
    furniture = useStore((s) => s.apartment.furniture),
    roomId = useStore((s) => s.roomId);
  return (
    <div className="room-strip" aria-label="Room previews">
      {rooms.map((r) => {
        const b = bounds(r);
        return (
          <button
            key={r.id}
            className={r.id === roomId ? "active" : ""}
            onClick={() =>
              useStore.setState({
                roomId: r.id,
                selectedId: null,
                selectedWall: null,
              })
            }
          >
            <svg
              viewBox={`${b.minX - 0.1} ${b.minZ - 0.1} ${b.maxX - b.minX + 0.2} ${b.maxZ - b.minZ + 0.2}`}
              aria-hidden="true"
            >
              <polygon
                points={r.points.map((p) => `${p.x},${p.z}`).join(" ")}
                fill={r.color}
                stroke="#aaa18b"
                strokeWidth=".06"
              />
              {furniture
                .filter((f) => f.roomId === r.id)
                .map((f) => (
                  <polygon
                    key={f.id}
                    points={footprint(f)
                      .map((p) => `${p.x},${p.z}`)
                      .join(" ")}
                    fill={f.color}
                    stroke="#847b66"
                    strokeWidth=".025"
                  />
                ))}
            </svg>
            <span>{r.name}</span>
          </button>
        );
      })}
    </div>
  );
}
