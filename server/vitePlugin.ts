import type { Plugin } from "vite";
import { attachCollaboration } from "./collaboration.ts";
import { serveBuild } from "./static.ts";
export function collaborationPlugin(): Plugin {
  return {
    name: "our-home-live-coop",
    configureServer(server) {
      if (!server.httpServer) return;
      const collaboration = attachCollaboration(
        server.httpServer as import("node:http").Server,
      );
      server.httpServer.once("close", () => {
        void collaboration.close();
      });
      server.middlewares.use((req, res, next) => {
        const host = (req.headers.host ?? "").split(":")[0];
        let configured = "";
        try {
          configured = new URL(process.env.PUBLIC_URL ?? "").hostname;
        } catch {
          /* no custom hostname */
        }
        if (
          host.endsWith(".trycloudflare.com") ||
          (configured && host === configured)
        ) {
          void serveBuild(req, res);
          return;
        }
        next();
      });
    },
  };
}
