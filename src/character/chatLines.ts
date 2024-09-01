import { KraftizenBot } from '../utils/types';
import { randomFromArray, sleep } from '../utils/utils';

const DEFAULT_LINES: Record<string, string | string[]> = {
  returning: ['I will return', 'Going home'],
  relaxing: ['I will do nothing now', 'Clocking off', 'Stopping work'],
  guarding: [
    'Eliminate all threats!',
    'Standing guard',
    'Protecting area',
    'Annihilate them!',
    'Smite them to smithereens!',
    'Take no prisoners',
    'The battlefield awaits.',
  ],
  chatter: [
    'I am so busy',
    'What even is life?',
    'Need recharge',
    'Have a nice day',
    'What are we doing?',
    'Beyond compare',
    'Umu umu.',
    'Wolves hunt in backs',
    'Goblins ill like fire',
  ],
  farming: [
    "It's honest work.",
    'I will watch crops grow.',
    'Feeding all kraftizens.',
    'Non-GMO.',
  ],
  hungry: 'I am hungry',
  hurt: 'In pain',
  loot: 'I will watch for items',
  melee: 'Close quarters only',
  nonLoSo: 'I do not understand "%command%". Read the manual, peasant.',
};

type LinesDict = typeof DEFAULT_LINES;

const generateLineDict = (customLines: Partial<LinesDict>) => ({
  ...DEFAULT_LINES,
  ...customLines,
});

type ChatOpts = {
  replacements: Array<[string, string]>;
  /** Chance to actually say line. 0-1 */
  chance?: number;
};

/**
 * Send a chat from the chat lookup.
 */
export const sendChat = (
  bot: KraftizenBot,
  messageOrKey: keyof LinesDict | string,
  { replacements = [], chance = 100 }: Partial<ChatOpts> = {}
) => {
  if (chance < 1) {
    const rng = Math.random() * 100;
    if (rng > chance) return;
  }
  const lineDict = CHAT_LINES[bot.player.username] ?? CHAT_LINES.default;
  const lookup = Array.isArray(lineDict[messageOrKey])
    ? randomFromArray(lineDict[messageOrKey])
    : lineDict[messageOrKey];
  const baseMessage: string = lookup ?? messageOrKey;
  let modifiedMessage = baseMessage;
  replacements.forEach(([key, value]) => {
    modifiedMessage = modifiedMessage.replace(`%${key}%`, value ?? 'blah');
  });

  bot.chat(modifiedMessage);
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
