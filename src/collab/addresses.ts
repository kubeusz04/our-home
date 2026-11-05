import type { Invite } from "./protocol";
export function serverAddress(value: string) {
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error(
      "Enter a complete server address, such as https://your-live-server.example.",
    );
  return url.origin;
}
export function parseInvite(value: string): Invite | null {
  try {
    const hash = value.startsWith("#")
      ? value.slice(1)
      : value.includes("#")
        ? new URL(value).hash.slice(1)
        : value;
    const params = new URLSearchParams(hash);
    const match = params.get("coop")?.match(/^([a-f0-9]{32})\.([a-f0-9]{48})$/);
    if (!match) return null;
    const server = params.get("server");
    return {
      room: match[1],
      token: match[2],
      ...(server ? { server: serverAddress(server) } : {}),
    };
  } catch {
    return null;
  }
}
export function inviteHash(invite: Invite) {
  return `coop=${invite.room}.${invite.token}${invite.server ? `&server=${encodeURIComponent(invite.server)}` : ""}`;
}
