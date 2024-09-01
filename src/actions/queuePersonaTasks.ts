import { sendChat } from '../character/chatLines';
import { getKnownHostileMobs } from '../utils/bot.utils';
import { HOME_RANGE } from '../utils/constants';
import Kraftizen from '../Kraftizen';
import { Persona } from '../utils/types';
import { Task } from './performTask';
import { hasWeapon } from './itemActions';
import { RateLimiterKeys } from '../utils/RateLimiter';
import { processDecisionModules } from './decisionModules.util';
import {
  allDecisionModules,
  boredomDecisionModules,
  defaultTaskDecisionModules,
} from './decisionModules';

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
    case Persona.loot:
      const items = await kraftizen.behaviors.getItems();

      if (items > 0) {
        kraftizen.addTask({ type: Task.collect });
        kraftizen.addTask({ type: Task.findBlock, deposit: true }, true);
      }
      break;
    case Persona.farmer:
      await processDecisionModules(kraftizen, [
        allDecisionModules.harvestField,
        allDecisionModules.sowField,
        allDecisionModules.collectItems,
        allDecisionModules.depositItems,
        allDecisionModules.visitBlock('composter'),
      ]);
      break;
    case Persona.guard:
      const nearbyMobs = getKnownHostileMobs(kraftizen.bot);

      if (
        nearbyMobs.length &&
        kraftizen.distanceFromHome(nearbyMobs[0].position) < HOME_RANGE &&
        !kraftizen.tasks.hasTask(Task.hunt)
      ) {
        await kraftizen.behaviors.attackNearest(nearbyMobs[0]);
      } else {
        // nothing to hunt
        const farFromHome = kraftizen.distanceFromHome() > 10;

        if (farFromHome) {
          kraftizen.bot.chat('All done here');
          kraftizen.addTask({ type: Task.return });
        } else {
          // Clean up
          kraftizen.addTask({ type: Task.collect });
        }
      }

      if (!hasWeapon(kraftizen.bot)) {
        const complain = kraftizen.rateLimiter.tryCall(
          RateLimiterKeys.unarmedGuard
        );

        if (complain)
          sendChat(kraftizen.bot, 'I have no weapons but I am a guard', {
            chance: 0.5,
          });
      }

      break;
    default:
      handleBoredom(kraftizen);
      break;
  }

  queueStandardTasks(kraftizen);
};

const queueStandardTasks = async (kraftizen: Kraftizen) =>
  processDecisionModules(kraftizen, defaultTaskDecisionModules);

/**
 * No assign persona, kraftizen is "bored"
 */
const handleBoredom = async (kraftizen: Kraftizen) => {
  /** If you have tasks you are not bored */
  if (!kraftizen.tasks.isEmpty()) return;

  await processDecisionModules(kraftizen, boredomDecisionModules);

  sendChat(
    kraftizen.bot,
    kraftizen.bot.food < 8
      ? 'hungry'
      : kraftizen.bot.health < 8
      ? 'hurt'
      : 'chatter',
    { chance: 0.5 }
  );
};
