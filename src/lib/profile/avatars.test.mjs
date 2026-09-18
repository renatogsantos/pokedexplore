import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PLAYER_AVATAR_ID,
  PLAYER_AVATARS,
  getPlayerAvatar,
  isValidPlayerAvatarId,
  normalizePlayerAvatarId,
} from "./avatars.js";

test("player avatar catalog exposes exactly nine stable local assets", () => {
  assert.equal(PLAYER_AVATARS.length, 9);
  assert.deepEqual(
    PLAYER_AVATARS.map(({ id, image }) => ({ id, image })),
    Array.from({ length: 9 }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");
      return { id: `avatar-${number}`, image: `/avatars/avatar-${number}.png` };
    }),
  );
});

test("missing and invalid avatar ids deterministically use the default", () => {
  assert.equal(normalizePlayerAvatarId(), DEFAULT_PLAYER_AVATAR_ID);
  assert.equal(normalizePlayerAvatarId("avatar-99"), DEFAULT_PLAYER_AVATAR_ID);
  assert.equal(getPlayerAvatar("avatar-99").id, DEFAULT_PLAYER_AVATAR_ID);
});

test("valid avatar ids remain unchanged", () => {
  assert.equal(isValidPlayerAvatarId("avatar-04"), true);
  assert.equal(normalizePlayerAvatarId("avatar-04"), "avatar-04");
  assert.equal(getPlayerAvatar("avatar-04").image, "/avatars/avatar-04.png");
});
