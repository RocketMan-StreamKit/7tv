import {
  fetchSevenTvEmoteSetById,
  fetchSevenTvGlobalEmoteSet,
  fetchSevenTvUserByTwitchId,
  mapSevenTvEmotes,
} from './api';
import {
  CHANNEL_RETRY_MS,
  EMOTES_POLL_MS,
  SEVENTV_EVENT_API_WS,
  TWITCH_PLATFORM,
} from './constants';

let twitchChannelId: string | null = null;
let channelEmoteSetId: string | null = null;
let globalEmoteSetId: string | null = null;
let channelRetryTimer: ReturnType<typeof setInterval> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
type SevenTvWsConnection = Awaited<
  ReturnType<typeof network.websocket.connect>
>;

let eventSocket: SevenTvWsConnection | null = null;
let starting = false;

const clearChannelRetryTimer = () => {
  if (channelRetryTimer) {
    clearInterval(channelRetryTimer);
    channelRetryTimer = null;
  }
};

const clearPollTimer = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

const closeEventSocket = () => {
  if (eventSocket) {
    try {
      eventSocket.Close();
      eventSocket.Destroy();
    } catch {
      // ignore teardown errors
    }
    eventSocket = null;
  }
};

/**
 * Registers merged global + channel 7TV emotes for Twitch chat rendering.
 * @param mapping Emote word to image URL map.
 */
const publishEmotes = async (mapping: Map<string, string>) => {
  const emotes = [...mapping.entries()].map(([word, url]) => ({ word, url }));
  if (!emotes.length) {
    return;
  }

  await dashboard.registerChatEmotes({
    platforms: [TWITCH_PLATFORM],
    emotes,
  });
};

/**
 * Loads global and channel 7TV emotes and pushes them to the dashboard.
 */
const refreshEmotes = async () => {
  if (!twitchChannelId) {
    return;
  }

  const mapping = new Map<string, string>();

  const globalSet = await fetchSevenTvGlobalEmoteSet();
  if (globalSet?.id) {
    globalEmoteSetId = globalSet.id;
  }
  for (const [word, url] of mapSevenTvEmotes(globalSet?.emotes)) {
    mapping.set(word, url);
  }

  const user = await fetchSevenTvUserByTwitchId(twitchChannelId);
  let channelEmotes = user?.emote_set?.emotes;
  if (user?.emote_set_id) {
    channelEmoteSetId = user.emote_set_id;
  }

  if ((!channelEmotes || channelEmotes.length === 0) && channelEmoteSetId) {
    const channelSet = await fetchSevenTvEmoteSetById(channelEmoteSetId);
    channelEmotes = channelSet?.emotes;
    if (channelSet?.id) {
      channelEmoteSetId = channelSet.id;
    }
  }

  for (const [word, url] of mapSevenTvEmotes(channelEmotes)) {
    mapping.set(word, url);
  }

  await publishEmotes(mapping);
};

const subscribeEventApi = async () => {
  closeEventSocket();

  try {
    const socket = await network.websocket.connect(SEVENTV_EVENT_API_WS);
    eventSocket = socket;

    socket.On('open', () => {
      if (globalEmoteSetId) {
        socket.Send(
          JSON.stringify({
            op: 35,
            d: {
              type: 'emote_set.update',
              condition: { object_id: globalEmoteSetId },
            },
          })
        );
      }

      if (twitchChannelId) {
        socket.Send(
          JSON.stringify({
            op: 35,
            d: {
              type: 'emote_set.update',
              condition: { channel: twitchChannelId, platform: 'TWITCH' },
            },
          })
        );
      }
    });

    socket.On('message', payload => {
      try {
        const msg = JSON.parse(payload) as { op?: number };
        if (msg.op === 0) {
          void refreshEmotes();
        }
      } catch {
        // ignore malformed event payloads
      }
    });

    socket.On('close', () => {
      if (eventSocket === socket) {
        eventSocket = null;
      }
    });
  } catch (error) {
    console.error('[7TV] Event API connection failed:', error);
  }
};

const ensurePollTimer = () => {
  if (pollTimer) {
    return;
  }
  pollTimer = setInterval(() => {
    void refreshEmotes();
  }, EMOTES_POLL_MS);
};

/**
 * Resolves Twitch channel id via the Twitch addon request endpoint.
 * @returns Twitch broadcaster id or `null` when unavailable.
 */
const resolveTwitchChannelId = async (): Promise<string | null> => {
  const response = await addons.request('twitch', 'getChannelId');
  if (!response?.success) {
    return null;
  }

  const result = response.result as { channelId?: string } | undefined;
  const channelId =
    typeof result?.channelId === 'string' ? result.channelId.trim() : '';
  return channelId || null;
};

const scheduleChannelRetry = () => {
  clearChannelRetryTimer();
  channelRetryTimer = setInterval(() => {
    void startSevenTvTracking();
  }, CHANNEL_RETRY_MS);
};

/**
 * Starts 7TV emote tracking for the current Twitch channel.
 */
export const startSevenTvTracking = async () => {
  if (starting) {
    return;
  }

  starting = true;
  try {
    const channelId = await resolveTwitchChannelId();
    if (!channelId) {
      scheduleChannelRetry();
      return;
    }

    clearChannelRetryTimer();
    twitchChannelId = channelId;
    await refreshEmotes();
    await subscribeEventApi();
    ensurePollTimer();
  } finally {
    starting = false;
  }
};

/**
 * Stops timers, websocket subscriptions, and clears cached channel state.
 */
export const stopSevenTvTracking = () => {
  clearChannelRetryTimer();
  clearPollTimer();
  closeEventSocket();
  twitchChannelId = null;
  channelEmoteSetId = null;
  globalEmoteSetId = null;
  starting = false;
};
