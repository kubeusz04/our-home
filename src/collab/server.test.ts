import { it, expect } from "vitest";
import { createServer } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { attachCollaboration } from "../../server/collaboration";
import { seed } from "../model/seed";
it("authenticates invites, broadcasts validated edits and restores the host copy", async () => {
  const directory = await mkdtemp(join(tmpdir(), "our-home-coop-"));
  let server = createServer(),
    coop = attachCollaboration(server, { directory });
  async function listen() {
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    return (server.address() as { port: number }).port;
  }
  let port = await listen();
  const clients: WebSocket[] = [];
  async function connect(origin = `http://127.0.0.1:${port}`) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/__coop`, {
      origin,
    });
    clients.push(ws);
    const messages: any[] = [];
    ws.on("message", (data) => messages.push(JSON.parse(String(data))));
    await new Promise<void>((r, e) => {
      ws.once("open", r);
      ws.once("error", e);
    });
    return {
      ws,
      send: (m: unknown) => ws.send(JSON.stringify(m)),
      wait: async (type: string) => {
        for (let i = 0; i < 100; i++) {
          const n = messages.findIndex((m) => m.type === type);
          if (n >= 0) return messages.splice(n, 1)[0];
          await new Promise((r) => setTimeout(r, 10));
        }
        throw Error(`Missing ${type}`);
      },
    };
  }
  async function stop() {
    for (const ws of clients) ws.close();
    await coop.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
  try {
    const host = await connect();
    host.send({
      type: "create",
      clientId: "host-123456",
      name: "Alex",
      apartment: seed,
    });
    const invite = await host.wait("welcome");
    const invalid = await connect();
    invalid.send({
      type: "join",
      clientId: "invalid-1234",
      room: invite.room,
      token: "0".repeat(48),
    });
    expect((await invalid.wait("error")).message).toBe("Invalid invitation.");
    const forbidden = new WebSocket(`ws://127.0.0.1:${port}/__coop`, {
      origin: "https://untrusted.example",
    });
    await expect(
      new Promise((resolve) =>
        forbidden.once("error", (error) => resolve(error.message)),
      ),
    ).resolves.toContain("403");
    await writeFile(
      join(directory, "allowed-origins.json"),
      JSON.stringify(["https://pages.example"]),
    );
    const partner = await connect("https://pages.example");
    partner.send({
      type: "join",
      clientId: "partner-1234",
      room: invite.room,
      token: invite.token,
    });
    await partner.wait("welcome");
    host.send({
      type: "ops",
      id: "edit-123456",
      changes: [
        { path: ["name"], before: seed.name, after: "Our shared plan" },
      ],
    });
    expect((await partner.wait("ops")).revision).toBe(1);
    partner.send({
      type: "ops",
      id: "stale-123456",
      changes: [{ path: ["name"], before: seed.name, after: "Stale" }],
    });
    expect((await partner.wait("rejected")).apartment.name).toBe(
      "Our shared plan",
    );
    await stop();
    server = createServer();
    coop = attachCollaboration(server, { directory });
    port = await listen();
    const rejoin = await connect();
    rejoin.send({
      type: "join",
      clientId: "rejoin-1234",
      room: invite.room,
      token: invite.token,
    });
    expect((await rejoin.wait("welcome")).apartment.name).toBe(
      "Our shared plan",
    );
  } finally {
    await stop();
  }
}, 10000);
