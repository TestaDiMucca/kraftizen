import { KraftizenBot } from '../types';

export const greet = (bot: KraftizenBot) => {
  const botName = bot.player.username;
  bot.chat(`${botName} Reporting in!`);
};
