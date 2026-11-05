import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { networkInterfaces } from "node:os";
import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { validateProject } from "../src/model/validation.ts";
import {
  applyChanges,
  changeKeys,
  validChange,
} from "../src/collab/protocol.ts";
import type { Apartment } from "../src/model/types.ts";
import type { Change, Peer } from "../src/collab/protocol.ts";
type Room = {
  id: string;
  tokenHash: string;
  apartment: Apartment;
  revision: number;
  clients: Map<string, { ws: WebSocket; peer: Peer; seen: number }>;
  requests: Map<string, true>;
  timer?: ReturnType<typeof setTimeout>;
  write: Promise<void>;
};
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const validId = (s: unknown): s is string =>
  typeof s === "string" && /^[a-f0-9]{32}$/.test(s);
const safeName = (v: unknown) =>
  typeof v === "string" ? v.trim().slice(0, 40) || "Partner" : "Partner";
export function attachCollaboration(
  server: Server,
  { directory = resolve(".local-share") } = {},
) {
  const rooms = new Map<string, Room>(),
    loading = new Map<string, Promise<Room>>(),
    wss = new WebSocketServer({
      noServer: true,
      maxPayload: 50 * 1024 * 1024,
      perMessageDeflate: false,
    });
  const send = (ws: WebSocket, message: unknown) => {
    if (ws.readyState === WebSocket.OPEN) {
      if (ws.bufferedAmount > 60 * 1024 * 1024) {
        ws.close(1013, "Connection too slow");
        return;
      }
      ws.send(JSON.stringify(message));
    }
  };
  const broadcast = (room: Room, message: unknown) => {
    for (const { ws } of room.clients.values()) send(ws, message);
  };
  const presence = (room: Room) =>
    broadcast(room, {
      type: "peers",
      peers: [...room.clients.values()].map((c) => c.peer),
    });
  const persist = (room: Room) => {
    clearTimeout(room.timer);
    room.timer = setTimeout(() => {
      room.write = room.write
        .catch(() => {})
        .then(async () => {
          await mkdir(directory, { recursive: true });
          const file = join(directory, room.id + ".json"),
            tmp = file + ".tmp";
          await writeFile(
            tmp,
            JSON.stringify({
              id: room.id,
              tokenHash: room.tokenHash,
              apartment: room.apartment,
              revision: room.revision,
            }),
          );
          await rename(tmp, file);
        })
        .catch(() =>
          broadcast(room, {
            type: "notice",
            message: "Shared server save failed. Export a local backup.",
          }),
        );
    }, 450);
  };
  async function load(id: string): Promise<Room> {
    if (rooms.has(id)) return rooms.get(id)!;
    if (loading.has(id)) return loading.get(id)!;
    const task = (async () => {
      const saved = JSON.parse(
        await readFile(join(directory, id + ".json"), "utf8"),
      );
      const room: Room = {
        id,
        tokenHash: saved.tokenHash,
        apartment: validateProject(saved.apartment),
        revision: saved.revision,
        clients: new Map(),
        requests: new Map(),
        write: Promise.resolve(),
      };
      rooms.set(id, room);
      return room;
    })();
    loading.set(id, task);
    try {
      return await task;
    } finally {
      loading.delete(id);
    }
  }
  async function publicAddress() {
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;
    try {
      const config = JSON.parse(
        await readFile(join(directory, "public-url.json"), "utf8"),
      );
      const address = server.address();
      if (
        address &&
        typeof address === "object" &&
        config.port === address.port &&
        typeof config.url === "string" &&
        /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(config.url)
      )
        return config.url;
    } catch {
      /* no active public tunnel */
    }
    return null;
  }
  const urls = (host: string) => {
    const port = host.match(/:\d+$/)?.[0] ?? "";
    return Object.values(networkInterfaces()).flatMap((list) =>
      (list ?? [])
        .filter((n) => n.family === "IPv4" && !n.internal)
        .map((n) => `http://${n.address}${port}`),
    );
  };
  const upgraded = async (
    request: import("node:http").IncomingMessage,
    socket: import("node:stream").Duplex,
    head: Buffer,
  ) => {
    if (request.url?.split("?")[0] !== "/__coop") return;
    try {
      let configuredOrigins: string[] = [];
      try {
        const saved = JSON.parse(
          await readFile(join(directory, "allowed-origins.json"), "utf8"),
        );
        if (Array.isArray(saved))
          configuredOrigins = saved.filter(
            (x: unknown) => typeof x === "string",
          );
      } catch {
        /* optional local host configuration */
      }
      const allowed = new Set([
        ...(process.env.COOP_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean),
        ...configuredOrigins,
      ]);
      if (
        !request.headers.origin ||
        (new URL(request.headers.origin).host !== request.headers.host &&
          !allowed.has(new URL(request.headers.origin).origin))
      ) {
        socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
        return;
      }
    } catch {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  };
  server.on("upgrade", upgraded);
  wss.on("connection", (ws, request) => {
    let joined: Room | undefined,
      clientId = "",
      alive = true;
    let messages = 0,
      windowStart = Date.now();
    const authTimer = setTimeout(() => {
      if (!joined) ws.close(1008, "Join a session first");
    }, 12000);
    let processing = Promise.resolve();
    ws.on("error", () => {});
    ws.on("pong", () => {
      alive = true;
    });
    const ping = setInterval(() => {
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, 15000);
    ws.on("message", (raw) => {
      processing = processing
        .then(async () => {
          const now = Date.now();
          if (now - windowStart > 1000) {
            messages = 0;
            windowStart = now;
          }
          if (++messages > 100) {
            ws.close(1008, "Too many edits");
            return;
          }
          const m = JSON.parse(raw.toString());
          if (!m || typeof m !== "object") throw Error("Invalid message.");
          if (!joined) {
            if (!["create", "join"].includes(m.type))
              throw Error("Join a session first.");
            if (
              typeof m.clientId !== "string" ||
              !/^[a-zA-Z0-9-]{8,80}$/.test(m.clientId)
            )
              throw Error("Invalid participant.");
            clientId = m.clientId;
            let room: Room, token: string | undefined;
            if (m.type === "create") {
              if (rooms.size >= 128) throw Error("Too many active sessions.");
              const apartment = validateProject(m.apartment),
                id = randomBytes(16).toString("hex");
              token = randomBytes(24).toString("hex");
              room = {
                id,
                tokenHash: hash(token),
                apartment,
                revision: 0,
                clients: new Map(),
                requests: new Map(),
                write: Promise.resolve(),
              };
              rooms.set(id, room);
              persist(room);
            } else {
              if (
                !validId(m.room) ||
                typeof m.token !== "string" ||
                !/^[a-f0-9]{48}$/.test(m.token)
              )
                throw Error("Invalid invitation.");
              try {
                room = await load(m.room);
              } catch {
                throw Error(
                  "This shared session was not found on this server.",
                );
              }
              if (
                !timingSafeEqual(
                  Buffer.from(room.tokenHash, "hex"),
                  Buffer.from(hash(m.token), "hex"),
                )
              )
                throw Error("Invalid invitation.");
            }
            if (room.clients.size >= 8 && !room.clients.has(clientId))
              throw Error("This session is full.");
            room.clients.get(clientId)?.ws.close(4001, "Reconnected elsewhere");
            const peer: Peer = {
              id: clientId,
              name: safeName(m.name),
              color: [
                "#74894f",
                "#bd795d",
                "#708aaa",
                "#ad7995",
                "#6b9a8c",
                "#ae9450",
                "#8674ad",
                "#a77868",
              ][room.clients.size % 8],
              selectedId: null,
              roomId: room.apartment.rooms[0].id,
              editing: null,
              cursor: null,
            };
            room.clients.set(clientId, { ws, peer, seen: now });
            joined = room;
            clearTimeout(authTimer);
            send(ws, {
              type: "welcome",
              room: room.id,
              token,
              apartment: room.apartment,
              revision: room.revision,
              clientId,
              peers: [...room.clients.values()].map((c) => c.peer),
              networkUrls: urls(request.headers.host ?? ""),
              publicUrl: await publicAddress(),
            });
            presence(room);
            return;
          }
          const room = joined,
            client = room.clients.get(clientId);
          if (!client || client.ws !== ws) return;
          client.seen = now;
          if (m.type === "resync") {
            send(ws, {
              type: "snapshot",
              apartment: room.apartment,
              revision: room.revision,
            });
            return;
          }
          if (m.type === "presence") {
            client.peer.name = safeName(m.name ?? client.peer.name);
            client.peer.selectedId =
              typeof m.selectedId === "string"
                ? m.selectedId.slice(0, 160)
                : null;
            client.peer.roomId =
              typeof m.roomId === "string"
                ? m.roomId.slice(0, 160)
                : client.peer.roomId;
            if (m.cursor === null) client.peer.cursor = null;
            else if (
              m.cursor &&
              Number.isFinite(m.cursor.x) &&
              Number.isFinite(m.cursor.z)
            )
              client.peer.cursor = { x: m.cursor.x, z: m.cursor.z };
            presence(room);
            return;
          }
          if (m.type === "lock") {
            if (
              typeof m.key !== "string" ||
              !/^(furniture|rooms|openings):.{1,160}$/.test(m.key)
            )
              throw Error("Invalid object.");
            const conflict = [...room.clients.values()].find(
              (c) =>
                c.peer.id !== clientId &&
                c.peer.editing &&
                (changeKeys(room.apartment, [
                  { path: m.key.split(":"), before: null, after: null },
                ]).has(c.peer.editing) ||
                  (m.key.startsWith("rooms:") &&
                    changeKeys(room.apartment, [
                      {
                        path: c.peer.editing.split(":"),
                        before: null,
                        after: null,
                      },
                    ]).has(m.key))),
            );
            if (conflict) {
              send(ws, {
                type: "lock-denied",
                key: m.key,
                message: `${conflict.peer.name} is editing this object.`,
              });
              return;
            }
            client.peer.editing = m.key;
            presence(room);
            return;
          }
          if (m.type === "unlock") {
            client.peer.editing = null;
            presence(room);
            return;
          }
          if (m.type === "ops") {
            if (
              typeof m.id !== "string" ||
              m.id.length > 100 ||
              !Array.isArray(m.changes) ||
              m.changes.length > 10000 ||
              !m.changes.every(validChange)
            )
              throw Error("Invalid edits.");
            if (room.requests.has(m.id)) {
              send(ws, { type: "ack", id: m.id, revision: room.revision });
              return;
            }
            try {
              const keys = changeKeys(room.apartment, m.changes as Change[]),
                owner = [...room.clients.values()].find(
                  (c) =>
                    c.peer.id !== clientId &&
                    c.peer.editing &&
                    keys.has(c.peer.editing),
                );
              if (owner)
                throw Error(`${owner.peer.name} is editing this object.`);
              const next = validateProject(
                applyChanges(room.apartment, m.changes, true),
              );
              room.apartment = next;
              room.revision++;
              room.requests.set(m.id, true);
              if (room.requests.size > 512)
                room.requests.delete(room.requests.keys().next().value!);
              broadcast(room, {
                type: "ops",
                id: m.id,
                clientId,
                changes: m.changes,
                revision: room.revision,
              });
              persist(room);
            } catch (error) {
              send(ws, {
                type: "rejected",
                id: m.id,
                apartment: room.apartment,
                revision: room.revision,
                message:
                  error instanceof Error ? error.message : "Edit rejected.",
              });
            }
            return;
          }
          throw Error("Unsupported message.");
        })
        .catch((error) => {
          send(ws, {
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not process this request.",
          });
          if (!joined) ws.close(1008, "Invalid session");
        });
    });
    ws.on("close", () => {
      clearTimeout(authTimer);
      clearInterval(ping);
      if (joined?.clients.get(clientId)?.ws === ws) {
        joined.clients.delete(clientId);
        presence(joined);
      }
    });
  });
  const clean = setInterval(() => {
    for (const room of rooms.values()) {
      let changed = false;
      for (const client of room.clients.values())
        if (client.peer.editing && Date.now() - client.seen > 12000) {
          client.peer.editing = null;
          changed = true;
        }
      if (changed) presence(room);
    }
  }, 3000);
  return {
    close: async () => {
      clearInterval(clean);
      server.off("upgrade", upgraded);
      for (const client of wss.clients) client.close(1001, "Server restarting");
      wss.close();
      for (const room of rooms.values()) {
        clearTimeout(room.timer);
        room.timer = undefined;
        await mkdir(directory, { recursive: true });
        await room.write.catch(() => {});
        await writeFile(
          join(directory, room.id + ".json"),
          JSON.stringify({
            id: room.id,
            tokenHash: room.tokenHash,
            apartment: room.apartment,
            revision: room.revision,
          }),
        );
      }
    },
  };
}
