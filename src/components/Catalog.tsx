import { useState } from "react";
import RoomStrip from "./RoomStrip";
import { Search, Plus } from "lucide-react";
import { catalog } from "../model/seed";
import { useStore } from "../model/store";
import { PlanSymbol } from "./PlanSymbol";
export default function Catalog() {
  const [q, setQ] = useState(""),
    [category, setCategory] = useState("All"),
    add = useStore((s) => s.addItem);
  const categories = ["All", ...new Set(catalog.map((c) => c.category))],
    filtered = catalog.filter(
      (c) =>
        (category === "All" || category === c.category) &&
        c.name.toLowerCase().includes(q.toLowerCase()),
    );
  return (
    <section className="catalog">
      <div className="catalog-heading">
        <h2>Furniture catalog</h2>
        <div className="catalog-tabs">
          {categories.map((c) => (
            <button
              className={category === c ? "active" : ""}
              key={c}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Search furniture"
            placeholder="Search furniture…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      <div className="catalog-items">
        {filtered.map((c) => (
          <button
            className="catalog-item"
            key={c.kind}
            onClick={() => add(c.kind)}
            aria-label={`Add: ${c.name}`}
          >
            <div className="catalog-image">
              <PlanSymbol kind={c.kind} color={c.color} />
              <span className="add-item">
                <Plus size={14} />
              </span>
            </div>
            <strong>{c.name}</strong>
            <small>
              {c.width.toFixed(2)} × {c.depth.toFixed(2)} m
            </small>
          </button>
        ))}
        {!filtered.length && (
          <p className="empty">No results. Try another name.</p>
        )}
      </div>
      <RoomStrip />
    </section>
  );
}
