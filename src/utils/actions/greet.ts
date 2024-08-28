import { KraftizenBot } from '../types';
import { randomFromArray } from '../utils';

export const greet = (bot: KraftizenBot) => {
  const botName = bot.player.username;
  bot.chat(
    `${botName} ${randomFromArray(['reporting in!', 'is here now', 'arrives'])}`
  );
};
