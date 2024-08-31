import { personaReturnsHome } from '../bot.utils';
import { RateLimiterKeys } from '../RateLimiter';
import { getRandomIntInclusive, randomFromArray } from '../utils';
import { DecisionModule } from './decisionModules.util';
import { Task } from './performTask';

export const attackAdjacentEnemies: DecisionModule = {
  name: 'Attack adjacent enemies',
  chance: 0.6,
  criteria: ({ kraftizen }) => {
    const nearbyEnemy = kraftizen.behaviors.getNearestHostileMob(5);
    return !!nearbyEnemy;
  },
  action: async ({ kraftizen }) => {
    /* Usually we should get attacked and respond anyway */
    const nearbyEnemy = kraftizen.behaviors.getNearestHostileMob(5);

    if (nearbyEnemy && kraftizen.tasks.taskQueue.length <= 1) {
      kraftizen.addTask({
        type: Task.hunt,
        entity: nearbyEnemy,
      });
    }
  },
};

export const trySleeping: DecisionModule = {
  name: 'Try sleeping',
  criteria: async ({ kraftizen }) =>
    !kraftizen.bot.time.isDay &&
    kraftizen.rateLimiter.tryCall(
      RateLimiterKeys.findBed,
      kraftizen.username
    ) &&
    !kraftizen.bot.isSleeping &&
    !kraftizen.sleeping,
  action: async ({ kraftizen }) => {
    const nearbyEnemy = kraftizen.behaviors.getNearestHostileMob(5);

    if (nearbyEnemy && kraftizen.tasks.taskQueue.length <= 1) {
      kraftizen.addTask({
        type: Task.hunt,
        entity: nearbyEnemy,
      });
    } else
      setTimeout(
        () =>
          kraftizen.addTask({
            type: Task.sleep,
          }),
        getRandomIntInclusive(1, 60) * 1000
      );
  },
};

export const forceEat: DecisionModule = {
  name: 'Eat',
  chance: 0.5,
  criteria: async ({ kraftizen }) => kraftizen.bot.food < 10,
  action: ({ kraftizen }) =>
    kraftizen.addTask({
      type: Task.eat,
    }),
};

export const lookAtSomething: DecisionModule = {
  name: 'Look at something',
  chance: 0.2,
  action: ({ kraftizen }) => {
    const nearbyEntity = randomFromArray(Object.values(kraftizen.bot.entities));

    if (nearbyEntity) kraftizen.bot.lookAt(nearbyEntity.position);
  },
};

export const goHome: DecisionModule = {
  name: 'Go home',
  chance: 0.1,
  criteria: ({ kraftizen, distanceFromHome }) =>
    distanceFromHome > 10 && personaReturnsHome(kraftizen.persona),
  action: ({ kraftizen }) => kraftizen.addTask({ type: Task.return }),
};

export const checkChests: DecisionModule = {
  name: 'Check chests',
  chance: 0.05,
  criteria: ({ kraftizen }) =>
    kraftizen.rateLimiter.tryCall(
      RateLimiterKeys.checkChests,
      kraftizen.bot.username
    ),
  action: ({ kraftizen }) => {
    const position = kraftizen.bot.entity.position;
    kraftizen.addTask({
      type: Task.findBlock,
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
  },
};

export const collectItems: DecisionModule = {
  name: 'Collect items',
  chance: 0.05,
  action: ({ kraftizen }) =>
    kraftizen.addTask({
      type: Task.collect,
    }),
};

export const visitBell: DecisionModule = {
  name: 'Visit bell',
  chance: 0.03,
  action: ({ kraftizen }) =>
    kraftizen.addTask({
      type: Task.findBlock,
      blockNames: ['bell'],
    }),
};

/**
 * For-convenience pre-packaged module bundles
 */

export const defaultTaskDecisionModules = [
  attackAdjacentEnemies,
  trySleeping,
  forceEat,
];

export const boredomDecisionModules = [
  lookAtSomething,
  goHome,
  checkChests,
  collectItems,
  visitBell,
];

export const allDecisionModules = {
  attackAdjacentEnemies,
  trySleeping,
  forceEat,
  lookAtSomething,
  goHome,
  checkChests,
  collectItems,
  visitBell,
};
