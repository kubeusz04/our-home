import { create } from "zustand";
import { useStore } from "../model/store";
import { db } from "../model/db";
import { randomId } from "../model/id";
import { validateProject } from "../model/validation";
import type { Apartment } from "../model/types";
import { collaborationBridge } from "./bridge";
import { serverAddress, inviteHash, parseInvite } from "./addresses";
export { parseInvite } from "./addresses";
import {
  applyChanges,
  changeKeys,
  diffProjects,
  equal,
  mergeChanges,
  readPath,
  reverseChanges,
} from "./protocol";
import type { Change, Invite, Peer } from "./protocol";
interface CoopState {
  serverUrl: string;
  status: "offline" | "connecting" | "connected" | "reconnecting" | "error";
  room: string | null;
  token: string | null;
  clientId: string;
  name: string;
  peers: Peer[];
  pending: number;
  revision: number;
  canUndo: boolean;
  canRedo: boolean;
  dialogOpen: boolean;
  error: string;
  networkUrls: string[];
  publicUrl: string | null;
  inviteOrigin: string;
}
function storedName() {
  try {
    return localStorage.getItem("our-home-name") || "Designer";
  } catch {
    return "Designer";
  }
}
export const useCoopStore = create<CoopState>(() => ({
  serverUrl: (() => {
    try {
      return (
        localStorage.getItem("our-home-coop-server") ||
        import.meta.env.VITE_COOP_SERVER_URL ||
        ""
      );
    } catch {
      return "";
    }
  })(),
  status: "offline",
  room: null,
  token: null,
  clientId: randomId(),
  name: storedName(),
  peers: [],
  pending: 0,
  revision: 0,
  canUndo: false,
  canRedo: false,
  dialogOpen: false,
  error: "",
  networkUrls: [],
  publicUrl: null,
  inviteOrigin: typeof location === "undefined" ? "" : location.origin,
}));
let socket: WebSocket | null = null,
  confirmed: Apartment | null = null,
  applying = false,
  active = false,
  intent:
    | { type: "create"; apartment: Apartment }
    | { type: "join"; invite: Invite }
    | null = null;
let queue: Change[] = [],
  sent = new Map<string, Change[]>(),
  undos: Change[][] = [],
  redos: Change[][] = [],
  gesture: { key: string; changes: Change[] } | null = null;
let flushTimer: ReturnType<typeof setTimeout> | undefined,
  retryTimer: ReturnType<typeof setTimeout> | undefined,
  presenceTimer: ReturnType<typeof setTimeout> | undefined,
  heartbeat: ReturnType<typeof setInterval> | undefined,
  unsubscribe: (() => void) | undefined,
  fatal = false,
  attempt = 0,
  cursor: { x: number; z: number } | null = null;
const notify = (message: string) => useStore.getState().notify(message);
const send = (message: unknown) => {
  if (socket?.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify(message));
};
const stats = () =>
  useCoopStore.setState({
    pending: sent.size + (queue.length ? 1 : 0),
    canUndo: undos.length > 0,
    canRedo: redos.length > 0,
  });
export function peerEditing(key: string) {
  const s = useCoopStore.getState();
  return s.peers.find((p) => p.id !== s.clientId && p.editing === key);
}
function allowed(before: Apartment, after: Apartment) {
  if (!active) return true;
  if (useCoopStore.getState().status !== "connected") {
    notify("Connection interrupted. Editing will resume when you reconnect.");
    return false;
  }
  const keys = changeKeys(before, diffProjects(before, after)),
    owner = useCoopStore
      .getState()
      .peers.find(
        (p) =>
          p.id !== useCoopStore.getState().clientId &&
          p.editing &&
          keys.has(p.editing),
      );
  if (owner) {
    notify(`${owner.name} is editing this object.`);
    return false;
  }
  return true;
}
function show(apartment: Apartment) {
  const s = useStore.getState(),
    roomId = apartment.rooms.some((r) => r.id === s.roomId)
      ? s.roomId
      : apartment.rooms[0].id,
    selectedId =
      apartment.furniture.some((f) => f.id === s.selectedId) ||
      apartment.openings.some((o) => o.id === s.selectedId)
        ? s.selectedId
        : null;
  applying = true;
  useStore.setState({
    apartment,
    roomId,
    selectedId,
    selectedWall:
      s.selectedWall &&
      apartment.rooms.some((r) => r.id === s.selectedWall!.roomId)
        ? s.selectedWall
        : null,
  });
  applying = false;
}
function renderOptimistic() {
  if (!confirmed) return;
  try {
    let a = confirmed;
    for (const ops of sent.values()) a = applyChanges(a, ops);
    a = applyChanges(a, queue);
    show(validateProject(a));
  } catch {
    queue = [];
    sent.clear();
    show(confirmed);
    notify(
      "A shared object changed while you were disconnected. The server copy was restored.",
    );
  }
  stats();
}
function flush() {
  clearTimeout(flushTimer);
  flushTimer = undefined;
  if (!queue.length || useCoopStore.getState().status !== "connected") return;
  const id = randomId(),
    changes = queue;
  queue = [];
  sent.set(id, changes);
  send({ type: "ops", id, changes });
  stats();
}
function schedule(ops: Change[]) {
  queue = mergeChanges(queue, ops);
  stats();
  if (!flushTimer) flushTimer = setTimeout(flush, 40);
}
function presence() {
  clearTimeout(presenceTimer);
  presenceTimer = undefined;
  if (!active || useCoopStore.getState().status !== "connected") return;
  const state = useStore.getState();
  send({
    type: "presence",
    name: useCoopStore.getState().name,
    selectedId: state.selectedId,
    roomId: state.roomId,
    cursor,
  });
}
function schedulePresence() {
  if (!presenceTimer) presenceTimer = setTimeout(presence, 80);
}
function undoShared(redo = false) {
  if (useCoopStore.getState().status !== "connected") return;
  const source = redo ? redos : undos,
    target = redo ? undos : redos,
    changes = source.pop();
  if (!changes) return;
  const desired = redo ? changes : reverseChanges(changes),
    state = useStore.getState().apartment;
  if (desired.some((c) => !equal(readPath(state, c.path), c.before))) {
    notify(
      "Cannot undo this edit because your partner changed the same fields.",
    );
    stats();
    return;
  }
  try {
    const a = validateProject(applyChanges(state, desired, true));
    if (!allowed(state, a)) {
      source.push(changes);
      stats();
      return;
    }
    show(a);
    target.push(changes);
    schedule(desired);
    flush();
  } catch {
    source.push(changes);
    notify("This edit cannot be undone after the latest shared changes.");
    stats();
  }
}
function begin(key: string) {
  if (!active) return true;
  if (useCoopStore.getState().status !== "connected") {
    notify("Wait for the shared connection before editing.");
    return false;
  }
  const a = useStore.getState().apartment,
    keys = changeKeys(a, [{ path: key.split(":"), before: null, after: null }]);
  const owner = useCoopStore
    .getState()
    .peers.find(
      (p) =>
        p.id !== useCoopStore.getState().clientId &&
        p.editing &&
        (keys.has(p.editing) ||
          (key.startsWith("rooms:") &&
            changeKeys(a, [
              { path: p.editing.split(":"), before: null, after: null },
            ]).has(key))),
    );
  if (owner) {
    notify(`${owner.name} is editing this object.`);
    return false;
  }
  gesture = { key, changes: [] };
  send({ type: "lock", key });
  presence();
  return true;
}
function end() {
  if (!active || !gesture) return;
  if (gesture.changes.length) {
    undos.push(gesture.changes);
    undos = undos.slice(-60);
    redos = [];
  }
  gesture = null;
  flush();
  send({ type: "unlock" });
  stats();
}
function attachBridge() {
  collaborationBridge.guard = allowed;
  collaborationBridge.undo = () => undoShared();
  collaborationBridge.redo = () => undoShared(true);
  collaborationBridge.begin = begin;
  collaborationBridge.end = end;
  collaborationBridge.cursor = (point) => {
    cursor = point;
    schedulePresence();
  };
}
export function inviteLink(origin = useCoopStore.getState().inviteOrigin) {
  const s = useCoopStore.getState();
  if (!s.room || !s.token) return "";
  try {
    const url = new URL(origin);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.pathname = location.pathname;
    url.search = "";
    url.hash = inviteHash({
      room: s.room,
      token: s.token,
      ...(s.serverUrl ? { server: s.serverUrl } : {}),
    });
    return url.toString();
  } catch {
    return "";
  }
}
function onMessage(event: MessageEvent) {
  try {
    const m = JSON.parse(String(event.data));
    if (m.type === "welcome") {
      const first = !confirmed;
      confirmed = validateProject(m.apartment);
      fatal = false;
      attempt = 0;
      useCoopStore.setState({
        status: "connected",
        room: m.room,
        token: m.token ?? useCoopStore.getState().token,
        peers: m.peers,
        revision: m.revision,
        networkUrls: m.networkUrls ?? [],
        publicUrl: m.publicUrl,
        error: "",
      });
      const c = useCoopStore.getState();
      const preferred =
        (c.serverUrl ? location.origin : m.publicUrl) ||
        (new URL(location.href).hostname === "localhost" ||
        location.hostname === "127.0.0.1"
          ? m.networkUrls?.[0]
          : location.origin) ||
        location.origin;
      if (first) useCoopStore.setState({ inviteOrigin: preferred });
      if (c.token)
        history.replaceState(
          null,
          "",
          `${location.pathname}${location.search}#${inviteHash({ room: c.room!, token: c.token, ...(c.serverUrl ? { server: c.serverUrl } : {}) })}`,
        );
      if (first) {
        undos = [];
        redos = [];
        useStore.setState({ past: [], future: [] });
      }
      renderOptimistic();
      for (const [id, changes] of sent) send({ type: "ops", id, changes });
      presence();
      flush();
      return;
    }
    if (m.type === "peers") {
      useCoopStore.setState({ peers: m.peers });
      return;
    }
    if (m.type === "ops") {
      const s = useCoopStore.getState();
      if (m.revision > s.revision + 1) {
        send({ type: "resync" });
        return;
      }
      if (m.revision > s.revision && confirmed) {
        confirmed = validateProject(applyChanges(confirmed, m.changes));
        useCoopStore.setState({ revision: m.revision });
      }
      sent.delete(m.id);
      renderOptimistic();
      return;
    }
    if (m.type === "ack") {
      sent.delete(m.id);
      renderOptimistic();
      return;
    }
    if (m.type === "snapshot") {
      confirmed = validateProject(m.apartment);
      useCoopStore.setState({ revision: m.revision });
      renderOptimistic();
      return;
    }
    if (m.type === "rejected" || m.type === "lock-denied") {
      if (m.apartment) {
        confirmed = validateProject(m.apartment);
        useCoopStore.setState({ revision: m.revision });
      }
      queue = [];
      sent.clear();
      gesture = null;
      undos = [];
      redos = [];
      renderOptimistic();
      send({ type: "unlock" });
      notify(m.message);
      return;
    }
    if (m.type === "notice") {
      notify(m.message);
      return;
    }
    if (m.type === "error") {
      if (!confirmed) {
        fatal = true;
        active = false;
        Object.keys(collaborationBridge).forEach(
          (k) =>
            delete collaborationBridge[k as keyof typeof collaborationBridge],
        );
        useCoopStore.setState({ status: "error", error: m.message, peers: [] });
      } else notify(m.message);
    }
  } catch {
    notify("Could not read a shared update. Reconnecting to the server copy.");
    send({ type: "resync" });
  }
}
function connect() {
  if (!active || !intent) return;
  clearTimeout(retryTimer);
  useCoopStore.setState({
    status: confirmed ? "reconnecting" : "connecting",
    error: "",
  });
  const endpoint = new URL(
    "/__coop",
    useCoopStore.getState().serverUrl || location.origin,
  );
  endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(endpoint);
  socket = ws;
  ws.onopen = () => {
    if (socket !== ws) return;
    const s = useCoopStore.getState();
    if (intent?.type === "create" && !s.room)
      send({
        type: "create",
        apartment: intent.apartment,
        clientId: s.clientId,
        name: s.name,
      });
    else {
      const invite =
        intent?.type === "join"
          ? intent.invite
          : { room: s.room!, token: s.token! };
      send({ type: "join", ...invite, clientId: s.clientId, name: s.name });
    }
  };
  ws.onmessage = (e) => {
    if (socket === ws) onMessage(e);
  };
  ws.onerror = () => {};
  ws.onclose = (event) => {
    if (socket !== ws) return;
    if (!active || fatal) return;
    if (event.code === 4001) {
      fatal = true;
      useCoopStore.setState({
        status: "error",
        error: "This tab was replaced by another connection.",
      });
      return;
    }
    useCoopStore.setState({
      status: "reconnecting",
      peers: [],
      error: "Connection interrupted. Editing is paused until it returns.",
    });
    retryTimer = setTimeout(
      connect,
      Math.min(5000, 500 * 2 ** Math.min(attempt++, 3)),
    );
  };
}
export function setDisplayName(name: string) {
  useCoopStore.setState({ name: name.slice(0, 40) });
  try {
    localStorage.setItem("our-home-name", name.slice(0, 40));
  } catch {
    /* private browsing */
  }
  schedulePresence();
}
export function setServerUrl(value: string) {
  if (active) return false;
  try {
    const url = value.trim() ? serverAddress(value.trim()) : "";
    if (location.protocol === "https:" && url.startsWith("http:"))
      throw Error("An HTTPS page needs an HTTPS live server address.");
    useCoopStore.setState({ serverUrl: url, error: "" });
    try {
      localStorage.setItem("our-home-coop-server", url);
    } catch {
      /* browser storage unavailable */
    }
    return true;
  } catch (error) {
    useCoopStore.setState({
      error: error instanceof Error ? error.message : "Invalid server address.",
    });
    return false;
  }
}
export function createSession() {
  if (active) return;
  if (
    location.hostname.endsWith(".github.io") &&
    !useCoopStore.getState().serverUrl
  ) {
    useCoopStore.setState({
      error:
        "Live co-op needs a live server address. Solo editing is available without one.",
    });
    return;
  }
  useCoopStore.setState({
    room: null,
    token: null,
    peers: [],
    pending: 0,
    error: "",
  });
  active = true;
  fatal = false;
  confirmed = null;
  queue = [];
  sent.clear();
  intent = {
    type: "create",
    apartment: structuredClone(useStore.getState().apartment),
  };
  attachBridge();
  connect();
}
export async function joinSession(invite: Invite) {
  if (active) return;
  if (invite.server && !setServerUrl(invite.server)) return;
  try {
    await db.versions.put({
      id: randomId(),
      name: "Before joining co-op",
      createdAt: new Date().toISOString(),
      apartment: structuredClone(useStore.getState().apartment),
    });
  } catch {
    useCoopStore.setState({
      status: "error",
      error: "Could not back up your local project. Export it before joining.",
    });
    return;
  }
  useCoopStore.setState({ room: invite.room, token: invite.token });
  active = true;
  fatal = false;
  confirmed = null;
  queue = [];
  sent.clear();
  intent = { type: "join", invite };
  attachBridge();
  connect();
}
export function leaveSession() {
  end();
  active = false;
  fatal = false;
  clearTimeout(retryTimer);
  clearTimeout(flushTimer);
  clearTimeout(presenceTimer);
  socket?.close(1000, "Left session");
  socket = null;
  confirmed = null;
  intent = null;
  queue = [];
  sent.clear();
  undos = [];
  redos = [];
  gesture = null;
  Object.keys(collaborationBridge).forEach(
    (k) => delete collaborationBridge[k as keyof typeof collaborationBridge],
  );
  useCoopStore.setState({
    status: "offline",
    room: null,
    token: null,
    peers: [],
    pending: 0,
    canUndo: false,
    canRedo: false,
    error: "",
  });
  useStore.setState({ past: [], future: [] });
  if (location.hash.startsWith("#coop="))
    history.replaceState(null, "", location.pathname + location.search);
  notify("You left co-op. This project is now your local copy.");
}
export function initializeCoop() {
  if (unsubscribe) return;
  unsubscribe = useStore.subscribe((state, previous) => {
    if (!active || applying) return;
    if (state.apartment !== previous.apartment) {
      const changes = diffProjects(previous.apartment, state.apartment);
      if (changes.length) {
        if (gesture) gesture.changes = mergeChanges(gesture.changes, changes);
        else {
          undos.push(changes);
          undos = undos.slice(-60);
          redos = [];
        }
        schedule(changes);
      }
    }
    if (
      state.selectedId !== previous.selectedId ||
      state.roomId !== previous.roomId
    )
      schedulePresence();
  });
  const offline = () => {
    if (active) {
      useCoopStore.setState({
        status: "reconnecting",
        error: "You are offline. Editing is paused.",
      });
      socket?.close(1000, "Offline");
    }
  };
  const online = () => {
    if (active && useCoopStore.getState().status !== "connected") connect();
  };
  const visibility = () => {
    if (document.hidden) end();
  };
  window.addEventListener("offline", offline);
  window.addEventListener("online", online);
  window.addEventListener("blur", end);
  document.addEventListener("visibilitychange", visibility);
  heartbeat = setInterval(presence, 3000);
  const invite = parseInvite(location.hash);
  if (invite) {
    useCoopStore.setState({ dialogOpen: true });
    void joinSession(invite);
  }
  return () => {
    unsubscribe?.();
    unsubscribe = undefined;
    clearInterval(heartbeat);
    window.removeEventListener("offline", offline);
    window.removeEventListener("online", online);
    window.removeEventListener("blur", end);
    document.removeEventListener("visibilitychange", visibility);
    if (active) leaveSession();
  };
}
