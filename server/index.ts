import { createServer } from "node:http";
import { attachCollaboration } from "./collaboration.ts";
import { serveBuild } from "./static.ts";
const server = createServer((req, res) => {
  void serveBuild(req, res);
});
const collaboration = attachCollaboration(server);
server.listen(
  Number(process.env.PORT ?? 4173),
  process.env.HOST ?? "0.0.0.0",
  () =>
    console.log(
      `Our Home with live co-op: http://localhost:${process.env.PORT ?? 4173}`,
    ),
);
let closing = false;
async function stop() {
  if (closing) return;
  closing = true;
  await collaboration.close();
  server.close(() => process.exit(0));
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
