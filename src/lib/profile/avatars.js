export const DEFAULT_PLAYER_AVATAR_ID = "avatar-01";

export const PLAYER_AVATARS = Object.freeze(
  Array.from({ length: 9 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return Object.freeze({
      id: `avatar-${number}`,
      image: `/avatars/avatar-${number}.png`,
      label: `Avatar ${index + 1}`,
    });
  }),
);

const PLAYER_AVATARS_BY_ID = new Map(
  PLAYER_AVATARS.map((avatar) => [avatar.id, avatar]),
);

export function isValidPlayerAvatarId(avatarId) {
  return PLAYER_AVATARS_BY_ID.has(String(avatarId || ""));
}

export function normalizePlayerAvatarId(avatarId) {
  return isValidPlayerAvatarId(avatarId)
    ? String(avatarId)
    : DEFAULT_PLAYER_AVATAR_ID;
}

export function getPlayerAvatar(avatarId) {
  return PLAYER_AVATARS_BY_ID.get(normalizePlayerAvatarId(avatarId));
}
