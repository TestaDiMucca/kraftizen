import { sendChat } from '../../character/chatLines';
import { getKnownHostileMobs, isNight, personaReturnsHome } from '../bot.utils';
import { HOME_RANGE } from '../constants';
import Kraftizen from '../Kraftizen';
import { Persona } from '../types';
import { getRandomIntInclusive, randomFromArray } from '../utils';
import { Task } from './performTask';
import rateLimiter from '../RateLimiter';
import { hasWeapon } from './itemActions';

rateLimiter.setLimitForKey('checkChests', {
  max: 1,
  windowMs: 1000 * 60 * 5,
});

rateLimiter.setLimitForKey('unarmedGuard', {
  max: 1,
  windowMs: 1000 * 60 * 30,
});

rateLimiter.setLimitForKey('findBed', {
  max: 1,
  windowMs: 1000 * 60 * 60 * 10,
});

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
        kraftizen.addTask({ type: Task.findChest, deposit: true }, true);
      }
      break;
    case Persona.guard:
      const nearbyMobs = getKnownHostileMobs(kraftizen.bot);

      if (
        nearbyMobs.length &&
        kraftizen.distanceFromHome(nearbyMobs[0].position) < HOME_RANGE &&
        !kraftizen.hasTask(Task.hunt)
      ) {
        kraftizen.addTask({
          type: Task.hunt,
          entity: nearbyMobs[0],
        });
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
        const complain = rateLimiter.tryCall(
          'unarmedGuard',
          kraftizen.bot.username
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

const queueStandardTasks = async (kraftizen: Kraftizen) => {
  const time = kraftizen.bot.time.timeOfDay;

  if (Math.random() < 0.1) {
    /* Usually we should get attacked and respond anyway */
    const nearbyEnemy = kraftizen.behaviors.getNearestHostileMob(5);

    if (nearbyEnemy && kraftizen.taskQueue.length <= 1) {
      kraftizen.addTask({
        type: Task.hunt,
        entity: nearbyEnemy,
      });
    }
  } else if (
    !kraftizen.bot.time.isDay &&
    rateLimiter.tryCall('findBed', kraftizen.username) &&
    !kraftizen.bot.isSleeping
  ) {
    setTimeout(
      () =>
        kraftizen.addTask({
          type: Task.sleep,
        }),
      getRandomIntInclusive(1, 60) * 1000
    );
  }
};

const handleBoredom = (kraftizen: Kraftizen) => {
  /** If you have tasks you are not bored */
  if (kraftizen.taskQueue.length > 0) return;

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
  } else if (
    Math.random() < 0.05 &&
    rateLimiter.tryCall('checkChests', kraftizen.bot.username)
  ) {
    const position = kraftizen.bot.entity.position;
    kraftizen.addTask({
      type: Task.findChest,
      multiple: true,
      withdraw: true,
    });
    kraftizen.addTask(
      {
        type: Task.visit,
        position,
      },
      true
    );
  } else if (Math.random() < 0.05) {
    kraftizen.addTask({
      type: Task.collect,
    });
  }

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
