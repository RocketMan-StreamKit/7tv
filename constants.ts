/** Twitch platform id used for chat emote registration. */
export const TWITCH_PLATFORM = 'twitch';

/** 7TV REST API base URL. */
export const SEVENTV_API_BASE = 'https://7tv.io/v3';

/** 7TV Event API WebSocket endpoint. */
export const SEVENTV_EVENT_API_WS = 'wss://events.7tv.io/v3';

/** Global 7TV emote set REST path. */
export const SEVENTV_GLOBAL_EMOTE_SET_PATH = '/emote-sets/global';

/** Poll interval when Twitch channel id is not yet available. */
export const CHANNEL_RETRY_MS = 30_000;

/** Fallback poll interval for emote refresh. */
export const EMOTES_POLL_MS = 30 * 60 * 1000;
