import { randomId } from '../model/id';
import { migrateVersion } from "../model/migrate";
import { money } from "../model/format";
import { useEffect, useState } from "react";
import {
  BookmarkPlus,
  Clock,
  Download,
  Trash2,
  ArrowUpRight,
  Wallet,
  Check,
  Flower2,
} from "lucide-react";
import { useStore } from "../model/store";
import { db } from "../model/db";
import { area } from "../model/geometry";
import { downloadJSON } from "../model/io";
import { NumberField } from "./Fields";
import type { ProjectVersion, ShoppingItem } from "../model/types";
export default function Planning() {
  const s = useStore(),
    a = s.apartment,
    [versions, setVersions] = useState<ProjectVersion[]>([]),
    [name, setName] = useState(""),
    [filter, setFilter] = useState("all"),
    [pln, setPln] = useState(false);
  async function refresh() {
    setVersions(
      (await db.versions.orderBy("createdAt").reverse().toArray()).map(
        migrateVersion,
      ),
    );
  }
  useEffect(() => {
    let alive = true;
    db.versions
      .orderBy("createdAt")
      .reverse()
      .toArray()
      .then((rows) => {
        if (alive) setVersions(rows.map(migrateVersion));
      })
      .catch(() =>
        useStore.getState().notify("Could not read saved versions."),
      );
    return () => {
      alive = false;
    };
  }, []);
  const items: ShoppingItem[] = a.furniture.map((f) => ({
    id: f.id,
    name: f.name,
    roomId: f.roomId,
    cost: f.cost,
    purchased: f.purchased,
  }));
  const total = items.reduce((n, f) => n + f.cost, 0),
    paid = items.filter((f) => f.purchased).reduce((n, f) => n + f.cost, 0),
    unpriced = items.filter((f) => !f.cost).length;
  const price = (n: number) =>
    pln
      ? new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: "PLN",
        }).format(n * a.rate)
      : money(n);
  return (
    <main className="planning">
      <div className="planning-intro">
        <div>
          <span className="eyebrow">OUR HOME · SHARED PLANS</span>
          <h1>
            {s.tab === "Planning"
              ? "A home for good ideas."
              : s.tab === "Budget"
                ? "Let’s plan our spending."
                : "One step closer to our home."}
          </h1>
          <p>
            {a.name} · {a.rooms.reduce((n, r) => n + area(r), 0).toFixed(1)} m²
            · concept dimensions
          </p>
        </div>
        <Flower2 size={50} strokeWidth={1} color="#7b8556" />
      </div>
      {s.tab === "Planning" ? (
        <>
          <div className="planning-columns">
            <section className="planning-block">
              <h2>Our ideas</h2>
              <label className="project-name">
                Project name
                <input
                  aria-label="Project name"
                  value={a.name}
                  onChange={(e) =>
                    s.change((a) => {
                      a.name = e.target.value;
                    })
                  }
                />
              </label>
              <textarea
                aria-label="Project notes"
                value={a.notes}
                onChange={(e) =>
                  s.change((a) => {
                    a.notes = e.target.value;
                  })
                }
              />
              <h3>Every room has a story</h3>
              {a.rooms.map((r) => (
                <button
                  className="planning-room"
                  key={r.id}
                  onClick={() =>
                    useStore.setState({
                      tab: "Project",
                      roomId: r.id,
                      selectedId: null,
                    })
                  }
                >
                  <span
                    className="room-color"
                    style={{ background: r.color }}
                  />
                  <span>
                    <strong>{r.name}</strong>
                    <small>
                      {r.notes || "Add inspiration and shared ideas"}
                    </small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))}
            </section>
            <section className="planning-block">
              <h2>Saved versions</h2>
              <p>Return to your favourite layout at any time.</p>
              <form
                className="version-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await db.versions.put({
                      id: randomId(),
                      name: name.trim() || `Version ${versions.length + 1}`,
                      createdAt: new Date().toISOString(),
                      apartment: structuredClone(a),
                    });
                    setName("");
                    await refresh();
                    s.notify("Project version saved.");
                  } catch {
                    s.notify("Could not save this version.");
                  }
                }}
              >
                <input
                  aria-label="Version name"
                  placeholder="e.g. Sage morning"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button className="primary">
                  <BookmarkPlus size={17} />
                  Save version
                </button>
              </form>
              <div className="versions">
                {versions.map((v) => (
                  <article className="version" key={v.id}>
                    <svg viewBox="-1 -2 12 12" aria-label={`Preview ${v.name}`}>
                      {v.apartment.rooms.map((r) => (
                        <polygon
                          key={r.id}
                          points={r.points
                            .map((p) => `${p.x},${p.z}`)
                            .join(" ")}
                          fill={r.color}
                          stroke="#fff"
                          strokeWidth=".12"
                        />
                      ))}
                    </svg>
                    <div>
                      <h3>{v.name}</h3>
                      <small>
                        <Clock size={12} />
                        {new Date(v.createdAt).toLocaleString("en-GB")}
                      </small>
                      <div className="inline">
                        <button
                          onClick={() => {
                            s.load(v.apartment);
                            s.notify(
                              "Version restored. You can undo to return to the previous state.",
                            );
                          }}
                        >
                          Restore
                        </button>
                        <button
                          className="icon-button"
                          title={`Export ${v.name}`}
                          onClick={() => downloadJSON(v.apartment)}
                        >
                          <Download size={15} />
                        </button>
                        <button
                          className="icon-button danger"
                          title={`Delete ${v.name}`}
                          onClick={async () => {
                            try {
                              await db.versions.delete(v.id);
                              await refresh();
                            } catch {
                              s.notify("Could not delete this version.");
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {!versions.length && (
                  <div className="empty-versions">
                    <BookmarkPlus size={35} />
                    <p>Your first idea deserves to be saved.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="budget-summary">
            <div>
              <Wallet size={23} />
              <span>
                Planned spending<strong>{price(total)}</strong>
              </span>
            </div>
            <div>
              <Check size={23} />
              <span>
                Purchased<strong>{price(paid)}</strong>
              </span>
            </div>
            <div>
              <span>
                Budget remaining
                <strong className={total > a.budget ? "negative" : ""}>
                  {price(a.budget - total)}
                </strong>
              </span>
            </div>
            <div>
              <span>
                Not priced yet<strong>{unpriced} items</strong>
              </span>
            </div>
          </div>
          <div className="budget-settings">
            <NumberField
              label="Our budget"
              value={a.budget}
              onChange={(v) => {
                if (v >= 0)
                  s.change((a) => {
                    a.budget = v;
                  });
              }}
              step={100000}
              unit="₩"
            />
            <NumberField
              label="1 KRW ="
              value={a.rate}
              onChange={(v) => {
                if (v > 0)
                  s.change((a) => {
                    a.rate = v;
                  });
              }}
              step={0.0001}
              unit="PLN"
            />
            <label className="check-row">
              <input
                type="checkbox"
                checked={pln}
                onChange={(e) => setPln(e.target.checked)}
              />
              Show PLN
            </label>
          </div>
          <div className="budget-progress">
            <i
              style={{
                width: `${Math.min(100, (total / a.budget) * 100) || 0}%`,
                background: total > a.budget ? "#b56b61" : undefined,
              }}
            />
          </div>
          <div className="table-heading">
            <h2>
              {s.tab === "Budget" ? "Furniture & costs" : "Our shopping list"}
            </h2>
            <select
              aria-label="Shopping filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All rooms</option>
              <option value="pending">Still to buy</option>
              <option value="unpriced">Not priced yet</option>
              {a.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <p className="muted">
            Enter prices manually. KRW 0 means not priced yet. The exchange rate
            is illustrative and editable.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Purchased</th>
                  <th>Item</th>
                  <th>Room</th>
                  <th>Estimated cost (KRW)</th>
                  <th>Notes / link</th>
                </tr>
              </thead>
              <tbody>
                {a.furniture
                  .filter(
                    (f) =>
                      filter === "all" ||
                      (filter === "pending" && !f.purchased) ||
                      (filter === "unpriced" && !f.cost) ||
                      f.roomId === filter,
                  )
                  .map((f) => (
                    <tr key={f.id} className={f.purchased ? "purchased" : ""}>
                      <td>
                        <input
                          aria-label={`Purchased: ${f.name}`}
                          type="checkbox"
                          checked={f.purchased}
                          onChange={(e) =>
                            s.updateItem(f.id, { purchased: e.target.checked })
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() =>
                            useStore.setState({
                              tab: "Project",
                              selectedId: f.id,
                              roomId: f.roomId,
                            })
                          }
                        >
                          {f.name}
                        </button>
                      </td>
                      <td>{a.rooms.find((r) => r.id === f.roomId)?.name}</td>
                      <td>
                        <NumberField
                          label={`Cost: ${f.name}`}
                          value={f.cost}
                          onChange={(v) => s.updateItem(f.id, { cost: v })}
                          step={1000}
                          min={0}
                          unit="₩"
                        />
                        {pln && <small>{price(f.cost)}</small>}
                      </td>
                      <td>
                        <input
                          aria-label={`Notes: ${f.name}`}
                          value={f.notes}
                          placeholder="Add a note…"
                          onChange={(e) =>
                            s.updateItem(f.id, { notes: e.target.value })
                          }
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
