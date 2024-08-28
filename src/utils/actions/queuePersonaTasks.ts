import { sendChat } from '../../character/chatLines';
import { getKnownHostileMobs, personaReturnsHome } from '../bot.utils';
import { HOME_RANGE } from '../constants';
import Kraftizen from '../Kraftizen';
import { Persona } from '../types';
import { randomFromArray } from '../utils';
import { Task } from './performTask';

/**
 * Queue tasks according to persona
 */
export const queuePersonaTasks = async (kraftizen: Kraftizen) => {
  switch (kraftizen.persona) {
    case Persona.follower:
      kraftizen.addTask({
        type: Task.come,
        username: kraftizen.lastCommandFrom,
      });
      break;
    case Persona.guard:
      const nearbyMobs = getKnownHostileMobs(kraftizen.bot);

      if (
        nearbyMobs.length &&
        kraftizen.distanceFromHome(nearbyMobs[0].position) < HOME_RANGE
      ) {
        kraftizen.addTask({
          type: Task.hunt,
          entity: nearbyMobs[0],
          silent: true,
        });
      } else {
        // nothing to hunt
        const farFromHome = kraftizen.distanceFromHome() > 10;

        if (farFromHome) {
          kraftizen.bot.chat('All done here');
          kraftizen.addTask({ type: Task.return });
        }
      }

      break;
    default:
      handleBoredom(kraftizen);
      break;
  }
};

const handleBoredom = (kraftizen: Kraftizen) => {
  const distanceFromHome = kraftizen.distanceFromHome();
  /** Bored */
  if (Math.random() < 0.2) {
    const nearbyEntity = randomFromArray(Object.values(kraftizen.bot.entities));

    if (nearbyEntity) kraftizen.bot.lookAt(nearbyEntity.position);
  } else if (
    Math.random() < 0.1 &&
    distanceFromHome > 10 &&
    personaReturnsHome(kraftizen.persona)
  ) {
    kraftizen.addTask({ type: Task.return });
  }

  sendChat(kraftizen.bot, 'chatter', { chance: 0.5 });
};
