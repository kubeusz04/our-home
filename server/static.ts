import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
const root = resolve("dist");
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
/** Public visitors see the build only; Vite source routes and private session files are never exposed. */
export async function serveBuild(req: IncomingMessage, res: ServerResponse) {
  try {
    const path = decodeURIComponent(
      new URL(req.url ?? "/", "http://localhost").pathname,
    );
    if (path === "/__coop-health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"ok":true}');
      return;
    }
    if (path.includes("/@") || path.includes("/.")) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    let file = resolve(root, "." + path);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!extname(file)) file = resolve(root, "index.html");
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] ?? "application/octet-stream",
      "Cache-Control":
        extname(file) === ".html" ? "no-store" : "public, max-age=3600",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}
