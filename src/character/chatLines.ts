import fs from 'fs/promises';
import path from 'path';

import { KraftizenBot } from '../utils/types';
import { deepMerge, randomFromArray, sleep } from '../utils/utils';
import { DEFAULT_LINES } from './chat.constants';

const CHAT_JSON = 'chats.json';

export { ChatKeys } from './chat.constants';

type LinesDict = typeof DEFAULT_LINES;

const generateLineDict = (customLines: Partial<LinesDict>) => ({
  ...DEFAULT_LINES,
  ...customLines,
});

type ChatOpts = {
  replacements: Array<[string, string]>;
  /** Chance to actually say line. 0-1 */
  chance?: number;
  delay?: number;
};

/**
 * Send a chat from the chat lookup.
 */
export const sendChat = (
  bot: KraftizenBot,
  messageOrKey: keyof LinesDict | string,
  { replacements = [], chance = 100, delay = 0 }: Partial<ChatOpts> = {}
) => {
  if (chance < 1) {
    const rng = Math.random() * 100;
    if (rng > chance) return;
  }
  const line =
    CHAT_LINES[bot.player.username]?.[messageOrKey] ??
    CHAT_LINES.default[messageOrKey];
  const lookup = Array.isArray(line) ? randomFromArray(line) : line;
  const baseMessage: string = lookup ?? messageOrKey;
  let modifiedMessage = baseMessage;
  replacements.forEach(([key, value]) => {
    modifiedMessage = modifiedMessage.replace(`%${key}%`, value ?? 'blah');
  });

  setTimeout(() => {
    bot.chat(modifiedMessage);
  }, delay);
};

/**
 * Bulk send chats automatically, spacing them out a bit
 */
export const sendChats = (
  bot: KraftizenBot,
  messagesOrKey: Array<keyof LinesDict | string>,
  { delay = 500, ...restOpts }: Partial<ChatOpts & { delay: number }> = {}
) => {
  void (async () => {
    for (let i = 0; i < messagesOrKey.length; i++) {
      sendChat(bot, messagesOrKey[i], restOpts);
      await sleep(delay);
    }
  })();
};

/**
 * Hash for lines by
 */
export const CHAT_LINES: Record<string, LinesDict> = {
  default: generateLineDict({}),
};

const loadChatLines = () => {
  const chatJsonPath = path.join(__dirname, CHAT_JSON);

  fs.readFile(chatJsonPath, { encoding: 'utf8' })
    .then((read) => {
      const parsed: Record<string, LinesDict> = JSON.parse(read);

      const merged = deepMerge(CHAT_LINES, parsed);

      console.log(merged);
    })
    .catch((e: Error) => {
      console.log(`Chat loading error: ${e.message}`);
    });
};

loadChatLines();
