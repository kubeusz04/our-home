import { spawn } from "node:child_process";
import { access, mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
const port = Number(process.env.SHARE_PORT ?? 5173);
const config = resolve(".local-share/public-url.json");
const executable =
  process.platform === "win32"
    ? resolve(".tools/cloudflared.exe")
    : "cloudflared";
await mkdir(".local-share", { recursive: true });
const siteIndex = process.argv.indexOf("--site");
if (siteIndex >= 0) {
  const site = new URL(process.argv[siteIndex + 1]);
  if (site.protocol !== "https:") throw Error("The public app must use HTTPS.");
  await writeFile(
    resolve(".local-share/allowed-origins.json"),
    JSON.stringify([site.origin]),
  );
}
if (process.platform === "win32") {
  try {
    await access(executable);
  } catch {
    console.log("Downloading the official Cloudflare Tunnel client…");
    await mkdir(".tools", { recursive: true });
    const response = await fetch(
      "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe",
    );
    if (!response.ok) throw Error("Could not download Cloudflare Tunnel.");
    await writeFile(executable, Buffer.from(await response.arrayBuffer()));
  }
}
let host: ReturnType<typeof spawn> | undefined;
try {
  const response = await fetch(`http://127.0.0.1:${port}`, {
    signal: AbortSignal.timeout(1500),
  });
  if (!(await response.text()).includes("Our Home"))
    throw Error(
      "The selected port is used by another application. Choose SHARE_PORT.",
    );
} catch (error) {
  if (error instanceof Error && error.message.includes("another application"))
    throw error;
  host = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    env: { ...process.env, PORT: String(port) },
    stdio: "inherit",
    windowsHide: true,
  });
  await new Promise<void>((done, reject) => {
    let tries = 0;
    const timer = setInterval(async () => {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/__coop-health`)).ok) {
          clearInterval(timer);
          done();
        }
      } catch {
        if (++tries > 30) {
          clearInterval(timer);
          reject(Error("The app did not start."));
        }
      }
    }, 250);
  });
}
const tunnel = spawn(
  executable,
  ["tunnel", "--url", `http://127.0.0.1:${port}`, "--no-autoupdate"],
  { windowsHide: true },
);
let announced = false,
  output = "";
for (const stream of [tunnel.stdout, tunnel.stderr])
  stream.on("data", async (data) => {
    output = (output + data.toString()).slice(-12000);
    const url = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
    if (url && !announced) {
      announced = true;
      await writeFile(config, JSON.stringify({ url, port }));
      console.log(
        `\nOpen ${url}\nChoose Co-op → Create shared session → Copy invite link.\nKeep this window and the host computer running. This address is temporary.\n`,
      );
    }
  });
tunnel.on("error", (error) => {
  console.error(error.message);
  void stop();
});
tunnel.on("exit", () => void stop());
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  tunnel.kill();
  host?.kill();
  await unlink(config).catch(() => {});
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
