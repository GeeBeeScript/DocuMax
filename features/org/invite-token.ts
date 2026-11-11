import { createHash, randomBytes } from "node:crypto";

/** Invite tokens: 192 random bits, URL-safe. Only the sha256 hash is stored (matches accept_invite()). */
export function createInviteToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
