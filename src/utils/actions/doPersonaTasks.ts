import { getKnownHostileMobs } from '../bot.utils';
import { HOME_RANGE } from '../constants';
import Kraftizen from '../Kraftizen';
import { Persona } from '../types';
import { Task } from './tasks';

/**
 * Queue tasks according to persona
 */
export const doPersonaTasks = async (kraftizen: Kraftizen) => {
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

        if (farFromHome) kraftizen.addTask({ type: Task.return });
      }

      break;
    default:
      break;
  }
};
