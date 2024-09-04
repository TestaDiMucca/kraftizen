import Kraftizen from '../Kraftizen';
import commandHandlers, { CommandHandler } from './command.handlers';

type Args = {
  /** who's handling this command */
  kraftizen: Kraftizen;
  /** sender of command */
  username: string;
  /** stripped of name */
  message: string;
};

/**
 * Search the aliases and patterns and find appropriate handler for it
 */
const processChatCommand = async ({ kraftizen, username, message }: Args) => {
  const matchingCommands = Object.keys(handlerDict);

  for (let i = 0; i < matchingCommands.length; i++) {
    const command = matchingCommands[i];

    if (message.includes(command)) {
      kraftizen.listening = false;
      kraftizen.lastCommandFrom = username;
      const handler = handlerDict[command] ?? commandHandlers.unknown;

      await handler({ kraftizen, username, message });
      break;
    }
  }
};

/**
 * Match keywords and phrases to a handler here
 */
const handlerDict: Record<string, CommandHandler> = {
  hello: commandHandlers.greet,
  eat: commandHandlers.eat,
  follow: commandHandlers.follow,
  guard: commandHandlers.guard,
  loot: commandHandlers.loot,
  home: commandHandlers.home,
  arms: commandHandlers.arms,
  off: commandHandlers.unsetPersona,
  relax: commandHandlers.unsetPersona,
  chill: commandHandlers.unsetPersona,
  collect: commandHandlers.collect,
  deposit: commandHandlers.deposit,
  unload: commandHandlers.deposit,
  stay: commandHandlers.stay,
  come: commandHandlers.come,
  here: commandHandlers.come,
  'camp here': commandHandlers.campHere,
  hunt: commandHandlers.hunt,
  farm: commandHandlers.farm,
  inventory: commandHandlers.inventory,
  objective: commandHandlers.objective,
  directive: commandHandlers.objective,
  'current task': commandHandlers.objective,
  location: commandHandlers.coordinates,
  coordinates: commandHandlers.coordinates,
  'where are you': commandHandlers.coordinates,
  return: commandHandlers.return,
  'prefer melee': commandHandlers.melee,
  brawl: commandHandlers.melee,
  sleep: commandHandlers.sleep,
  wake: commandHandlers.wake,
  withdraw: commandHandlers.withdraw,
  hold: commandHandlers.hold,
  wait: commandHandlers.hold,
  'stock up': commandHandlers.withdraw,
};

export default processChatCommand;
