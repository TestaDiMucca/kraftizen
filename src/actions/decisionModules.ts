import { Vec3 } from 'vec3';
import { personaReturnsHome } from '../utils/bot.utils';
import { RateLimiterKeys } from '../utils/RateLimiter';
import { getRandomIntInclusive, randomFromArray } from '../utils/utils';
import { DecisionModule, DecisionModuleFactory } from './decisionModules.util';
import { getItemInInventory } from './itemActions';
import { Task } from './performTask';
import { HOME_RANGE } from '../utils/constants';

export const attackAdjacentEnemies: DecisionModule = {
  name: 'Attack adjacent enemies',
  chance: 0.6,
  criteria: ({ kraftizen, targetEnemy }) => {
    if (kraftizen.tasks.hasTask(Task.hunt)) return;

    const nearbyEnemy = kraftizen.behaviors.getNearestHostileMob(5);

    targetEnemy = nearbyEnemy;
    return !!nearbyEnemy;
  },
  action: async ({ kraftizen, targetEnemy }) => {
    /* Usually we should get attacked and respond anyway */
    const nearbyEnemy = targetEnemy;

    if (nearbyEnemy && kraftizen.tasks.taskQueue.length <= 1) {
      /** Bypass queue for urgently close enemies */
      kraftizen.behaviors.attackWildly(nearbyEnemy);
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
    const nearbyEnemy = kraftizen.behaviors.getNearestHostileMob(
      HOME_RANGE / 2
    );

    if (nearbyEnemy && kraftizen.tasks.taskQueue.length <= 1) {
      kraftizen.behaviors.attackNearest(nearbyEnemy);
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
    /**
     * Try not to pick some directly below underground thing
     */
    const nearbyEntity = randomFromArray(
      Object.values(kraftizen.bot.entities).filter(
        (entity) => entity.position.y > kraftizen.bot.entity.position.y - 4
      )
    );

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

    /** return here */
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

export const visitBlock: DecisionModuleFactory = (
  blockName: string
): DecisionModule => ({
  name: `Visit ${blockName}`,
  chance: 0.03,
  action: ({ kraftizen }) =>
    kraftizen.addTask({
      type: Task.findBlock,
      blockNames: [blockName],
      ignoreY: true,
    }),
});

export const harvestField: DecisionModule = {
  name: 'Harvest fields',
  criteria: async (context) => {
    const { kraftizen } = context;

    await kraftizen.bot.unequip('hand');

    /** too much meta for normal findBlock helper */
    const harvestCrop = kraftizen.bot.findBlock({
      point: kraftizen.bot.entity.position,
      maxDistance: kraftizen.behaviors.range,
      // TODO: support other types
      matching: (block) =>
        block &&
        block.type === kraftizen.bot.registry.blocksByName.wheat.id &&
        block.metadata === 7,
      useExtraInfo: true,
    });

    if (harvestCrop) {
      context.targetBlock = harvestCrop;
      return true;
    }

    return false;
  },
  action: async ({ kraftizen, targetBlock }) => {
    if (!targetBlock) return;

    if (kraftizen.bot.entity.position.distanceTo(targetBlock.position) > 5) {
      await kraftizen.behaviors.toCoordinate(targetBlock.position, 0, 2);
    }

    await kraftizen.bot.dig(targetBlock, true);
  },
};

export const sowField: DecisionModule = {
  name: 'Sow fields',
  criteria: (context) => {
    const { kraftizen } = context;

    const wheatSeeds = getItemInInventory(kraftizen.bot, 'wheat_seeds');

    if (!wheatSeeds && kraftizen.rateLimiter.tryCall('findSeeds')) {
      kraftizen.addTask({
        type: Task.findBlock,
        withdraw: ['wheat_seeds'],
        multiple: true,
      });
      return false;
    }

    context.targetItem = wheatSeeds;

    const emptyFarmland = kraftizen.bot.findBlock({
      point: kraftizen.bot.entity.position,
      matching: kraftizen.bot.registry.blocksByName.farmland.id,
      maxDistance: kraftizen.behaviors.range,
      useExtraInfo: (block) => {
        const blockAbove = kraftizen.bot.blockAt(
          block.position.offset(0, 1, 0)
        );
        return !blockAbove || blockAbove.type === 0;
      },
    });

    if (emptyFarmland) {
      context.targetBlock = emptyFarmland;
      return true;
    }

    return false;
  },
  action: async ({ kraftizen, targetBlock, targetItem }) => {
    if (!targetBlock || !targetItem) return;

    if (kraftizen.bot.entity.position.distanceTo(targetBlock.position) > 5) {
      await kraftizen.behaviors.toCoordinate(targetBlock.position, 0, 2);
    }

    if (targetItem) await kraftizen.bot.equip(targetItem, 'hand');
    try {
      await kraftizen.bot.placeBlock(targetBlock, new Vec3(0, 1, 0));
    } catch (e) {
      console.log('placeBlock error', e.message);
    }
  },
};

export const depositItems: DecisionModule = {
  name: 'Depositing items',
  criteria: ({ kraftizen }) => {
    const emptySlots = kraftizen.bot.inventory.emptySlotCount();
    return emptySlots < 5;
  },
  action: ({ kraftizen }) =>
    kraftizen.addTask({
      type: Task.findBlock,
      deposit: true,
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
  visitBlock('bell'),
];

export const allDecisionModules = {
  attackAdjacentEnemies,
  trySleeping,
  forceEat,
  lookAtSomething,
  goHome,
  checkChests,
  collectItems,
  harvestField,
  sowField,
  depositItems,
  visitBlock,
};
