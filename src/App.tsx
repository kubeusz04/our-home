import CoopDialog, { CoopButton, LivePresence } from "./components/CoopDialog";
import { initializeCoop, useCoopStore } from "./collab/client";
import { Component, lazy, Suspense, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  Home,
  Box,
  Grid2X2,
  CalendarDays,
  Wallet,
  ShoppingCart,
  Save,
  Upload,
  Download,
  Undo2,
  Redo2,
  Sun,
  Moon,
  HelpCircle,
  Check,
} from "lucide-react";
import { useStore } from "./model/store";
import { db, saveProject } from "./model/db";
import { parseProject, downloadJSON } from "./model/io";
import { area } from "./model/geometry";
import Sidebar from "./components/Sidebar";
import Inspector from "./components/Inspector";
import Catalog from "./components/Catalog";
import Planning from "./components/Planning";
import PlanEditor from "./editor/PlanEditor";
import "./App.css";
const SceneEditor = lazy(() => import("./scene/SceneEditor"));
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-error">
        <Box size={40} />
        <h2>3D view is unavailable</h2>
        <p>
          This browser could not start WebGL. You can still edit your project in
          the 2D plan.
        </p>
        <button
          className="primary"
          onClick={() => useStore.setState({ view: "2d" })}
        >
          Open 2D plan
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
let saves = Promise.resolve();
export default function App() {
  const coop = useCoopStore();
  const s = useStore(),
    file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    db.projects
      .get("current")
      .then((row) => {
        if (alive) {
          if (row) {
            const a = parseProject(JSON.stringify(row.apartment));
            useStore.setState({
              apartment: a,
              roomId: a.rooms[0].id,
              selectedId: null,
            });
          }
          useStore.setState({
            hydrated: true,
            saveStatus: "Saved locally",
          });
        }
      })
      .catch(() => {
        if (alive)
          useStore.setState({
            hydrated: true,
            saveStatus: "Browser storage unavailable",
            message:
              "Could not read the local save. Export your project as JSON.",
          });
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (s.hydrated) return initializeCoop();
  }, [s.hydrated]);
  useEffect(() => {
    if (!s.hydrated) return;
    useStore.setState({ saveStatus: "Saving…" });
    const timer = setTimeout(() => {
      saves = saves.catch(() => {}).then(() => saveProject(s.apartment));
      saves
        .then(() => useStore.setState({ saveStatus: "Saved locally" }))
        .catch(() =>
          useStore.setState({
            saveStatus: "Save failed",
            message: "Saving failed. Export your project as JSON.",
          }),
        );
    }, 400);
    return () => clearTimeout(timer);
  }, [s.apartment, s.hydrated]);
  useEffect(() => {
    if (!s.message) return;
    const timer = setTimeout(() => useStore.setState({ message: "" }), 4200);
    return () => clearTimeout(timer);
  }, [s.message]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      const s = useStore.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
      }
      if (
        e.key === "Delete" &&
        s.selectedId &&
        s.apartment.furniture.some((f) => f.id === s.selectedId)
      )
        s.removeItem(s.selectedId);
      if (e.key === "Escape") s.select(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  async function save() {
    useStore.setState({ saveStatus: "Saving…" });
    try {
      saves = saves
        .catch(() => {})
        .then(() => saveProject(useStore.getState().apartment));
      await saves;
      useStore.setState({
        saveStatus: "Saved locally",
        message: "Your project is safely saved in this browser.",
      });
    } catch {
      s.notify("Could not save. Please export your project as JSON.");
    }
  }
  if (!s.hydrated)
    return (
      <div className="initial-loading" role="status">
        <Home size={36} />
        <p>Opening our home…</p>
      </div>
    );
  const project = s.tab === "Project" || s.tab === "Rooms";
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            useStore.setState({ tab: "Project" });
          }}
        >
          <Home size={31} strokeWidth={1.5} />
          <div>
            Our Home<small>our shared space</small>
          </div>
        </a>
        <nav>
          {[
            { label: "Project", icon: Box },
            { label: "Rooms", icon: Grid2X2 },
            { label: "Planning", icon: CalendarDays },
            { label: "Budget", icon: Wallet },
            { label: "Shopping list", icon: ShoppingCart },
          ].map((n) => (
            <button
              key={n.label}
              className={s.tab === n.label ? "active" : ""}
              onClick={() =>
                useStore.setState({
                  tab: n.label,
                  ...(n.label === "Rooms"
                    ? { selectedId: null, view: "2d" as const }
                    : {}),
                })
              }
            >
              <n.icon size={17} strokeWidth={1.6} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <CoopButton />
          <button
            title="Import project JSON"
            onClick={() => file.current?.click()}
          >
            <Upload size={17} />
            <span>Import</span>
          </button>
          <button
            onClick={() => downloadJSON(s.apartment)}
            title="Export project JSON"
          >
            <Download size={17} />
            <span>Export</span>
          </button>
          <button
            aria-label="Save"
            className="primary"
            onClick={save}
            disabled={!s.hydrated}
          >
            <Save size={17} />
            <span>Save</span>
          </button>
        </div>
        <input
          hidden
          ref={file}
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              if (f.size > 50 * 1024 * 1024)
                throw Error("The file is too large (maximum 50 MB).");
              s.load(parseProject(await f.text()));
            } catch (err) {
              s.notify(
                err instanceof Error
                  ? err.message
                  : "Could not import this file.",
              );
            }
            e.target.value = "";
          }}
        />
      </header>
      {project ? (
        <div className="workspace">
          <Sidebar />
          <div className="center-column">
            <div className="workspace-heading">
              <div>
                <span className="eyebrow">CONCEPT PROJECT</span>
                <h1>{s.apartment.name}</h1>
                <p>
                  {s.apartment.rooms
                    .reduce((n, r) => n + area(r), 0)
                    .toFixed(1)}{" "}
                  m² <span>·</span> {s.apartment.rooms.length} rooms
                </p>
              </div>
            </div>
            <div className="canvas-area">
              <LivePresence />
              <div className="floating-toolbar">
                <div className="toolbar-group">
                  <button
                    title="Undo (Ctrl+Z)"
                    disabled={coop.room ? !coop.canUndo : !s.past.length}
                    onClick={s.undo}
                  >
                    <Undo2 size={18} />
                  </button>
                  <button
                    title="Redo (Ctrl+Shift+Z)"
                    disabled={coop.room ? !coop.canRedo : !s.future.length}
                    onClick={s.redo}
                  >
                    <Redo2 size={18} />
                  </button>
                </div>
                <div className="toolbar-group view-name">
                  <Box size={16} />
                  {s.view === "2d"
                    ? "Apartment plan"
                    : s.view === "walk"
                      ? "Walk through home"
                      : "3D perspective"}
                </div>
                <div className="toolbar-group">
                  <button
                    title={s.evening ? "Daylight" : "Evening lighting"}
                    className={s.evening ? "active" : ""}
                    onClick={() => useStore.setState({ evening: !s.evening })}
                  >
                    {s.evening ? <Moon size={18} /> : <Sun size={18} />}
                  </button>
                  <button
                    title="Controls help"
                    onClick={() =>
                      s.notify(
                        "2D: drag furniture. Outline: drag corners and walls. Move room: drag the room and its contents. 3D: select an item, then Move, Rotate or Scale. Walk: use WASD and drag to look around.",
                      )
                    }
                  >
                    <HelpCircle size={18} />
                  </button>
                </div>
              </div>
              {s.view === "2d" ? (
                <PlanEditor />
              ) : (
                <SceneBoundary>
                  <Suspense
                    fallback={
                      <div className="loading">
                        <Box size={32} />
                        <p>Preparing our home…</p>
                      </div>
                    }
                  >
                    <SceneEditor />
                  </Suspense>
                </SceneBoundary>
              )}
            </div>
            <Catalog />
          </div>
          <Inspector />
        </div>
      ) : (
        <Planning />
      )}
      <footer className="statusbar">
        <span>
          <i className={s.saveStatus === "Saved locally" ? "saved" : ""} />
          {s.saveStatus}
        </span>
        <span>Illustrative dimensions · enter your own prices</span>
        <span>
          <Check size={12} />{" "}
          {coop.room ? "Shared with your session" : "Local and private"}
        </span>
      </footer>
      <CoopDialog />
      {s.message && (
        <div className="toast" role="status">
          {s.message}
          <button
            aria-label="Dismiss message"
            onClick={() => useStore.setState({ message: "" })}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
