import { KraftizenBot } from '../utils/types';
import { randomFromArray } from '../utils/utils';

const DEFAULT_LINES: Record<string, string | string[]> = {
  returning: 'I will return',
  relaxing: ['I will do nothing now', 'Clocking off'],
  guarding: ['I will eliminate all threats!', 'Standing guard'],
  chatter: [
    'I am so busy',
    'What even is life?',
    'Need recharge',
    'Have a nice day',
    'What are we doing?',
  ],
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
 * Hash for lines by
 */
export const CHAT_LINES: Record<string, LinesDict> = {
  default: generateLineDict({}),
};
