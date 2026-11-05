import { it, expect } from "vitest";
import { inviteHash, parseInvite, serverAddress } from "./addresses";
it("preserves Pages invitations and the separate co-op server", () => {
  const invite = {
    room: "a".repeat(32),
    token: "b".repeat(48),
    server: "https://live.example",
  };
  const hash = inviteHash(invite);
  expect(parseInvite("#" + hash)).toEqual(invite);
  expect(parseInvite("https://user.github.io/our-home/#" + hash)).toEqual(
    invite,
  );
  expect(parseInvite("coop=" + invite.room + "." + invite.token)).toEqual({
    room: invite.room,
    token: invite.token,
  });
});
it("rejects malformed invitations and non-HTTP or credentialed servers", () => {
  expect(parseInvite("#coop=invalid")).toBeNull();
  expect(
    parseInvite(
      "#" +
        inviteHash({ room: "a".repeat(32), token: "b".repeat(48) }) +
        "&server=javascript%3Aalert(1)",
    ),
  ).toBeNull();
  for (const url of [
    "javascript:alert(1)",
    "https://name:password@example.com",
    "https://example.com/path",
    "https://example.com/?key=secret",
  ])
    expect(() => serverAddress(url)).toThrow();
  expect(serverAddress("https://example.com/")).toBe("https://example.com");
});
