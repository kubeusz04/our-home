import { useState } from "react";
import { Users, Link2, Copy, LogOut, Wifi, WifiOff, X } from "lucide-react";
import {
  useCoopStore,
  createSession,
  joinSession,
  leaveSession,
  inviteLink,
  parseInvite,
  setDisplayName,
  setServerUrl,
} from "../collab/client";
import { useStore } from "../model/store";
export function CoopButton() {
  const c = useCoopStore(),
    others = c.peers.filter((p) => p.id !== c.clientId);
  return (
    <button
      className={`coop-button ${c.status === "connected" ? "live" : ""}`}
      aria-label="Co-op"
      onClick={() => useCoopStore.setState({ dialogOpen: true })}
    >
      <Users size={17} />
      <span>
        {c.status === "connected" ? `Co-op · ${others.length + 1}` : "Co-op"}
      </span>
      {c.status === "connected" && <i />}
    </button>
  );
}
export function LivePresence() {
  const c = useCoopStore();
  if (!c.room && c.status !== "connecting") return null;
  const others = c.peers.filter((p) => p.id !== c.clientId),
    editing = others.filter((p) => p.editing);
  return (
    <div
      className={`live-presence ${c.status !== "connected" ? "interrupted" : ""}`}
      role="status"
      aria-label="Co-op status"
    >
      {c.status === "connected" ? <Wifi size={13} /> : <WifiOff size={13} />}
      <span>
        {c.status === "connected"
          ? c.pending
            ? "Syncing edits…"
            : others.length
              ? "Live together"
              : "Waiting for your partner"
          : "Reconnecting · editing paused"}
      </span>
      {others.map((peer) => (
        <span
          className="peer-badge"
          key={peer.id}
          style={{ borderColor: peer.color }}
        >
          <i style={{ background: peer.color }} />
          {peer.name}
        </span>
      ))}
      {editing.length > 0 && (
        <span className="peer-activity">
          {editing.map((p) => `${p.name} is editing`).join(" · ")}
        </span>
      )}
    </div>
  );
}
export default function CoopDialog() {
  const c = useCoopStore(),
    [serverDraft, setServer] = useState<string | null>(null),
    [link, setLink] = useState(""),
    [tab, setTab] = useState<"create" | "join">("create");
  const server = serverDraft ?? c.serverUrl;
  if (!c.dialogOpen) return null;
  const connected =
      !!c.room && (c.status === "connected" || c.status === "reconnecting"),
    url = inviteLink(),
    isLocal = (() => {
      try {
        return ["localhost", "127.0.0.1", "[::1]"].includes(
          new URL(c.inviteOrigin).hostname,
        );
      } catch {
        return false;
      }
    })();
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      useStore.getState().notify("Invite link copied.");
    } catch {
      useStore
        .getState()
        .notify("Select the invite link and copy it manually.");
    }
  }
  return (
    <div
      className="coop-backdrop"
      onClick={() => useCoopStore.setState({ dialogOpen: false })}
    >
      <section
        className="coop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coop-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="coop-dialog-header">
          <div>
            <span className="eyebrow">OUR HOME · LIVE CO-OP</span>
            <h2 id="coop-title">Make room for two.</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close co-op dialog"
            onClick={() => useCoopStore.setState({ dialogOpen: false })}
          >
            <X size={19} />
          </button>
        </div>
        <p className="coop-description">
          Move furniture, shape rooms and choose finishes together. Your partner
          sees changes while you drag, in both 2D and 3D.
        </p>
        <label className="appearance-label">
          Your name
          <input
            aria-label="Your name"
            value={c.name}
            maxLength={40}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        {connected ? (
          <>
            <div className="coop-connection" data-testid="shared-status">
              <i />
              {c.status === "connected"
                ? c.pending
                  ? "Syncing…"
                  : "Connected · all edits synced"
                : "Reconnecting…"}
              <small>{c.peers.length} participants</small>
            </div>
            <div className="coop-participants">
              {c.peers.map((p) => (
                <span key={p.id}>
                  <i style={{ background: p.color }} />
                  {p.name}
                  {p.id === c.clientId ? " (you)" : ""}
                </span>
              ))}
            </div>
            <label className="appearance-label">
              Invite address
              <input
                aria-label="Invite address"
                value={c.inviteOrigin}
                placeholder="https://your-shared-address.example"
                onChange={(e) =>
                  useCoopStore.setState({ inviteOrigin: e.target.value })
                }
              />
            </label>
            {!c.publicUrl && c.networkUrls.length > 0 && (
              <div className="network-addresses">
                <span>On the same Wi-Fi:</span>
                {c.networkUrls.map((address) => (
                  <button
                    className="text-button"
                    key={address}
                    onClick={() =>
                      useCoopStore.setState({ inviteOrigin: address })
                    }
                  >
                    {address}
                  </button>
                ))}
              </div>
            )}
            <label className="appearance-label">
              Partner invite link
              <div className="invite-copy">
                <input
                  aria-label="Partner invite link"
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  title="Copy invite link"
                  aria-label="Copy invite link"
                  onClick={copy}
                  disabled={!url}
                >
                  <Copy size={17} />
                </button>
              </div>
            </label>
            <p className="coop-help">
              Anyone with this private link can edit this session. Keep the host
              running.{" "}
              {isLocal
                ? "This localhost address only works on this computer. "
                : ""}
              {c.serverUrl
                ? "Your invitation opens this site and connects to the live server. Keep that server running."
                : c.publicUrl
                  ? "This public link works from different locations. Keep the sharing window open; its address is temporary."
                  : "For different locations, start internet sharing on the host computer, then create a session and copy its public invite link."}
            </p>
            <button className="leave-coop" onClick={leaveSession}>
              <LogOut size={16} />
              Leave co-op · keep a local copy
            </button>
          </>
        ) : (
          <>
            <label className="appearance-label">
              Live server address
              <input
                aria-label="Live server address"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="https://your-live-server.example"
              />
              <small>
                For live co-op on GitHub Pages, enter your host’s HTTPS address.
                An invitation includes it automatically. Solo editing works
                without a server.
              </small>
            </label>
            <div className="coop-tabs">
              <button
                className={tab === "create" ? "active" : ""}
                onClick={() => setTab("create")}
              >
                Start together
              </button>
              <button
                className={tab === "join" ? "active" : ""}
                onClick={() => setTab("join")}
              >
                Join a partner
              </button>
            </div>
            {tab === "create" ? (
              <div className="coop-start">
                <p>
                  Share the project currently open in your editor. Each person
                  keeps their own camera and selection.
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    if (setServerUrl(server)) createSession();
                  }}
                  disabled={
                    c.status === "connecting" || c.status === "reconnecting"
                  }
                >
                  <Users size={17} />
                  {c.status === "connecting"
                    ? "Creating session…"
                    : "Create shared session"}
                </button>
              </div>
            ) : (
              <form
                className="coop-start"
                onSubmit={(e) => {
                  e.preventDefault();
                  const invite = parseInvite(link);
                  if (!invite) {
                    useCoopStore.setState({
                      error: "Paste a complete co-op invitation link.",
                    });
                    return;
                  }
                  try {
                    if (new URL(link).origin !== location.origin) {
                      location.assign(link);
                      return;
                    }
                  } catch {
                    /* hash invite */
                  }
                  if (invite.server || setServerUrl(server))
                    void joinSession(invite);
                }}
              >
                <label className="appearance-label">
                  Invitation link
                  <input
                    aria-label="Invitation link"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="Paste your partner’s invite link"
                    required
                  />
                </label>
                <p>
                  Your current local project is backed up in Saved versions
                  before joining.
                </p>
                <button
                  className="primary"
                  disabled={c.status === "connecting"}
                >
                  <Link2 size={17} />
                  Join shared session
                </button>
              </form>
            )}
          </>
        )}
        {c.error && (
          <p className="coop-error" role="alert">
            {c.error}
          </p>
        )}
        {!connected &&
          ["connecting", "reconnecting", "error"].includes(c.status) && (
            <button className="leave-coop" onClick={leaveSession}>
              Cancel connection · keep editing locally
            </button>
          )}
        <div className="coop-footer">
          Live movement · shared colours and textures · undo your own edits
        </div>
      </section>
    </div>
  );
}
