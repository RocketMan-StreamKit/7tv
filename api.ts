import { SEVENTV_API_BASE, SEVENTV_GLOBAL_EMOTE_SET_PATH } from './constants';

type SevenTvEmoteHost = {
  url?: string;
  files?: { name?: string }[];
};

type SevenTvEmoteData = {
  name?: string;
  host?: SevenTvEmoteHost;
};

type SevenTvEmoteEntry = {
  name?: string;
  data?: SevenTvEmoteData;
};

type SevenTvEmoteSet = {
  id?: string;
  emotes?: SevenTvEmoteEntry[];
};

type SevenTvUserResponse = {
  emote_set_id?: string | null;
  emote_set?: SevenTvEmoteSet | null;
};

/**
 * Builds a CDN image URL for a 7TV emote host descriptor.
 * @param host 7TV host object from API responses.
 * @returns Absolute HTTPS image URL or `null` when unavailable.
 */
export const resolveSevenTvEmoteUrl = (
  host?: SevenTvEmoteHost | null
): string | null => {
  const base = typeof host?.url === 'string' ? host.url.trim() : '';
  if (!base) {
    return null;
  }

  const normalizedBase = base.startsWith('//') ? `https:${base}` : base;
  const files = Array.isArray(host?.files) ? host.files : [];
  const preferred =
    files.find(file => file?.name === '2x.webp') ??
    files.find(file => file?.name === '1x.webp') ??
    files[0];

  if (preferred?.name) {
    return `${normalizedBase}/${preferred.name}`;
  }

  return `${normalizedBase}/2x.webp`;
};

/**
 * Extracts chat word → image URL pairs from a 7TV emote set payload.
 * @param emotes Emote list from REST API.
 * @returns Map of emote names to CDN URLs.
 */
export const mapSevenTvEmotes = (
  emotes: SevenTvEmoteEntry[] | undefined
): Map<string, string> => {
  const mapping = new Map<string, string>();
  for (const entry of emotes ?? []) {
    const word =
      (typeof entry?.name === 'string' && entry.name) ||
      (typeof entry?.data?.name === 'string' && entry.data.name) ||
      '';
    if (!word) {
      continue;
    }

    const url = resolveSevenTvEmoteUrl(entry?.data?.host);
    if (!url) {
      continue;
    }

    mapping.set(word, url);
  }

  return mapping;
};

/**
 * Fetches the platform-wide 7TV global emote set.
 * @returns Parsed emote set JSON or `null` on failure.
 */
export const fetchSevenTvGlobalEmoteSet =
  async (): Promise<SevenTvEmoteSet | null> => {
    try {
      const response = await network.request.get(
        `${SEVENTV_API_BASE}${SEVENTV_GLOBAL_EMOTE_SET_PATH}`
      );
      return JSON.parse(response) as SevenTvEmoteSet;
    } catch (error) {
      console.error('[7TV] Failed to fetch global emotes:', error);
      return null;
    }
  };

/**
 * Fetches 7TV user data for a Twitch broadcaster id.
 * @param twitchChannelId Twitch user id of the channel.
 * @returns Parsed user payload or `null` on failure.
 */
export const fetchSevenTvUserByTwitchId = async (
  twitchChannelId: string
): Promise<SevenTvUserResponse | null> => {
  if (!twitchChannelId) {
    return null;
  }

  try {
    const response = await network.request.get(
      `${SEVENTV_API_BASE}/users/twitch/${encodeURIComponent(twitchChannelId)}`
    );
    return JSON.parse(response) as SevenTvUserResponse;
  } catch (error) {
    console.error('[7TV] Failed to fetch channel user:', error);
    return null;
  }
};

/**
 * Fetches a 7TV emote set by id.
 * @param emoteSetId 7TV emote set identifier.
 * @returns Parsed emote set or `null` on failure.
 */
export const fetchSevenTvEmoteSetById = async (
  emoteSetId: string
): Promise<SevenTvEmoteSet | null> => {
  if (!emoteSetId) {
    return null;
  }

  try {
    const response = await network.request.get(
      `${SEVENTV_API_BASE}/emote-sets/${encodeURIComponent(emoteSetId)}`
    );
    return JSON.parse(response) as SevenTvEmoteSet;
  } catch (error) {
    console.error('[7TV] Failed to fetch emote set:', error);
    return null;
  }
};
