import { goals, Movements } from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';
import { Entity, KraftizenBot, Position } from '../utils/types';
import {
  calculateDistance3D,
  getRandomIntInclusive,
  posString,
  sleep,
} from '../utils/utils';
import {
  botPosition,
  canSeeCoordinate,
  checkIfBedIsOccupied,
  getNearestHostileMob,
} from '../utils/bot.utils';
import {
  GOAL_POLL_INTERVAL,
  MELEE_RANGE,
  NEAR_RANGE,
  PATH_FINDING_TIMEOUT,
  RANGE,
  SHOOT_RANGE,
} from '../utils/constants';
import {
  equipBestToolOfType,
  equipRanged,
  getFood,
  hasWeapon,
} from './itemActions';
import { ChatKeys, sendChat, sendChats } from '../character/chatLines';
import TeamMessenger from '../utils/TeamMessenger';

type BehaviorsEngineOpts = {
  defaultMove: Movements;
  bot: KraftizenBot;
  messenger: TeamMessenger;
  defaultTargetPlayer: string | null;
  range?: number;
};

type AttackMode = 'melee' | 'normal' | 'peace';

export default class BehaviorsEngine {
  defaultMove: Movements;
  bot: KraftizenBot;
  defaultTargetPlayer: string | null = null;
  range = RANGE;
  attackMode: AttackMode = 'normal';
  teamMessenger: TeamMessenger;

  constructor(opts: BehaviorsEngineOpts) {
    this.defaultMove = opts.defaultMove;
    this.bot = opts.bot;
    this.defaultTargetPlayer = opts.defaultTargetPlayer;
    this.teamMessenger = opts.messenger;
  }

  private setBotGoal = (goal: goals.Goal) => {
    if (this.bot.pathfinder.goal) this.bot.pathfinder.setGoal(null);

    if (!goal) return;

    this.bot.pathfinder.setGoal(goal, true);
  };

  public eat = async (verbose?: boolean) => {
    const food = await getFood(this.bot);

    if (!food) {
      if (verbose) this.bot.chat('I have no food');
      return;
    }

    if (this.bot.food === 20) {
      if (verbose) this.bot.chat('not hungry');
      return;
    }

    this.bot.equip(food, 'hand');
    this.bot.activateItem();
    await sleep(2000);
    this.bot.deactivateItem();
  };

  public goSleep = async (triesLeft = 5) => {
    try {
      if (this.bot.isSleeping) return;

      const bed = this.bot.findBlock({
        matching: (block) => {
          if (!block) return false;

          return (
            this.bot.isABed(block) && !checkIfBedIsOccupied(this.bot, block)
          );
        },
        maxDistance: 100,
        useExtraInfo: true,
      });

      if (!bed) return this.bot.chat('No bed nearby...');

      const reached = await this.toCoordinate(bed.position, 0, 1);

      if (reached && !this.bot.time.isDay) {
        this.bot.sleep(bed).catch((e: Error) => {
          console.error(e.message);
          if (e.message.includes('monsters')) {
            this.attackNearest(undefined, this.range, undefined, true);
          } else if (e.message.includes('not sleeping')) {
            void this.bot.wake().catch(() => {});
          } else {
            if (triesLeft > 0)
              setTimeout(() => {
                this.goSleep(triesLeft - 1);
              }, 1000);
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  /**
   *
   * @returns If we reached the goal
   */
  public toCoordinate = async (
    position: Position,
    /** Randomness in goal */
    deviation = 0,
    /** Navigate to this many blocks away */
    nearRange = 1,
    ignoreY = false
  ): Promise<boolean> => {
    return new Promise(async (resolve) => {
      try {
        this.bot.lookAt(new Vec3(position.x, position.y, position.z));
        let timeElapsed = 0;
        const onGoalReached = (gaveUp = false) => {
          if (posTest) clearInterval(posTest);
          resolve(!gaveUp);
        };

        const offset =
          deviation > 0 ? getRandomIntInclusive(-deviation, deviation) : 0;

        const goal = ignoreY
          ? new goals.GoalNearXZ(
              position.x + offset,
              position.z + offset,
              nearRange
            )
          : new goals.GoalNear(
              position.x + offset,
              position.y,
              position.z + offset,
              nearRange
            );

        /** Probably another GoalChanged error, who cares */
        this.bot.pathfinder.goto(goal).catch(() => {});

        let lastPosString: string | null = null;
        let checksInLastPost = 0;
        const posTest = setInterval(() => {
          if (
            timeElapsed > PATH_FINDING_TIMEOUT &&
            !this.bot.pathfinder.isMoving()
          ) {
            onGoalReached(true);
            return;
          }

          const currPos = botPosition(this.bot);
          const currPosString = posString(currPos);
          const distance = calculateDistance3D(
            { x: position.x, y: position.y, z: position.z },
            currPos
          );

          /** Don't stay stuck for > 2 checks */
          if (currPosString === lastPosString) {
            if (checksInLastPost > 2) {
              onGoalReached(true);
              return;
            }
            checksInLastPost++;
          }

          if (distance < NEAR_RANGE * 2) {
            onGoalReached(false);
            clearInterval(posTest);
          }
          lastPosString = currPosString;
          timeElapsed += GOAL_POLL_INTERVAL;
        }, GOAL_POLL_INTERVAL);
      } catch (e) {
        resolve(false);
      }
    });
  };

  public findBlock = (
    range = this.range,
    blocks = ['chest', 'barrel'],
    visited: Set<string> = new Set(),
    position?: Position
  ) => {
    if (position) {
      const specifiedChest = this.bot.blockAt(
        new Vec3(position.x, position.y, position.z)
      );

      if (specifiedChest) return specifiedChest;
    }

    const allChests = this.bot
      .findBlocks({
        matching: blocks.map((name) => this.bot.registry.blocksByName[name].id),
        maxDistance: range,
        count: 5,
      })
      .sort((chestA, chestB) => {
        return (
          chestA.distanceTo(this.bot.entity.position) -
          chestB.distanceTo(this.bot.entity.position)
        );
      });

    const filtered = allChests.filter(
      (chest) => !visited.has(posString(chest))
    );

    if (filtered.length === 0) return null;

    return this.bot.blockAt(filtered[0]);
  };

  public goToChest = async (
    blocks = ['chest', 'barrel'],
    visited: Set<string> = new Set(),
    range = this.range,
    ignoreY = false
  ) => {
    const chestToOpen = this.findBlock(range, blocks, visited);

    if (!chestToOpen) return;

    await this.toCoordinate(chestToOpen.position, 0, 1, ignoreY);

    return chestToOpen;
  };

  public findFood = () => {
    const food = this.bot.inventory.slots.find(
      (item) => !!this.bot.registry.foodsByName[item.type]
    );
    return food;
  };

  public getArmorEquipped = (
    armorType: 'helmet' | 'chestplate' | 'leggings' | 'boots'
  ) => {
    const armor = this.bot.entity.equipment.find((eq) =>
      eq.name.endsWith(armorType)
    );
    return armor;
  };

  public toPlayer = async (username: string) => {
    const player = this.bot.players[username].entity;

    if (!player) {
      this.bot.chat('I have nobody to follow.');
    }

    await this.toCoordinate(
      { x: player.position.x, y: player.position.y, z: player.position.z },
      NEAR_RANGE
    );
  };

  public cancelAll = async () => {
    try {
      this.bot.pathfinder.setGoal(null);
    } catch (e) {
      console.error('Error cancelling all', e);
    }
  };

  public listInventory = async () => {
    const inventory = this.bot.inventory.slots.filter((s) => !!s);
    sendChats(
      this.bot,
      ['I seem to have...', ...inventory.map((i) => `${i.name} (${i.count})`)],
      {
        delay: 700,
      }
    );
  };

  /** Get nearby items */
  public getItems = async (onItem?: (entity: Entity) => void) => {
    // TODO: someday communicate across kraftizens if they marked an item to collect
    const drops = Object.values(this.bot.entities)
      .filter((entity) => entity.name === 'item' || entity.name === 'arrow')
      .filter(
        (drop) =>
          drop.position.distanceTo(this.bot.entity.position) < this.range
      )
      .sort((dropA, dropB) => {
        return (
          dropA.position.distanceTo(this.bot.entity.position) -
          dropB.position.distanceTo(this.bot.entity.position)
        );
      });

    drops.forEach((drop) => onItem?.(drop));
    return drops.length;
  };

  private canShootWithBow = (target: Entity): 'noBow' | 'yes' | 'outRange' => {
    if (
      !hasWeapon(this.bot, 'arrow') ||
      !hasWeapon(this.bot, 'ranged') ||
      this.attackMode != 'normal'
    )
      return 'noBow';

    const distance = calculateDistance3D(
      botPosition(this.bot),
      target.position
    );

    const canSee = canSeeCoordinate(this.bot, target.position);

    if (!canSee) return 'noBow';

    return distance < SHOOT_RANGE
      ? distance < 5
        ? 'noBow'
        : 'yes'
      : 'outRange';
  };

  private shootWithBow = async (target: Entity) => {
    const weapon = await equipRanged(this.bot);

    if (weapon === 'crossbow') {
      this.bot.activateItem(); // charge
      await sleep(1250); // wait for crossbow to charge
      this.bot.deactivateItem(); // raise weapon
      await sleep(200);
    }

    /** don't move and shoot, you'll miss fool */
    if (this.bot.pathfinder.isMoving()) return;

    const aim = () => {
      const distance = this.bot.entity.position.distanceTo(target.position);
      const heightAdjust = target.height * 0.3 + distance * 0.05;
      this.bot.lookAt(target.position.offset(0, heightAdjust, 0));
    };

    aim();
    await this.bot.waitForTicks(5);
    this.bot.activateItem();
    if (weapon === 'bow') {
      await sleep(1000);
      aim();
      await this.bot.waitForTicks(5);
    }
    this.bot.deactivateItem();
  };

  /**
   * Get nearest mob we have walking access to
   */
  public getNearestHostileMob = (range = this.range) => {
    return getNearestHostileMob(this.bot, range ?? this.range, (mob) => {
      if (mob.position.distanceTo(this.bot.entity.position) > this.range)
        return false;

      return this.isPathPossible(mob.position);
    });
  };

  public attackNearest = async (
    target?: Entity,
    range?: number,
    chat = false,
    forceMelee = false
  ) => {
    if (this.bot.pathfinder.goal) return;

    const nearestHostile = target ?? this.getNearestHostileMob(range);

    if (!nearestHostile) {
      if (chat) this.bot.chat('Looks like nothing nearby');
      return;
    }

    const canShoot = forceMelee
      ? 'noBow'
      : this.canShootWithBow(nearestHostile);

    const nextLoop = () => {
      if (nearestHostile.isValid)
        setTimeout(() => this.attackNearest(nearestHostile), 500);
      else {
        if (chat) this.bot.chat('All too easy');
      }
    };

    if (canShoot !== 'noBow') {
      if (canShoot === 'outRange')
        await this.moveToEntity(nearestHostile, SHOOT_RANGE);

      await this.shootWithBow(nearestHostile);

      nextLoop();

      return;
    }

    this.bot.lookAt(nearestHostile.position);

    this.equipMeleeWeapon();

    if (chat) this.bot.chat(`Begone, ${nearestHostile.name ?? 'fiend'}!`);
    await this.moveToEntity(nearestHostile, undefined, MELEE_RANGE);
    if (chat) this.bot.chat('En garde!');

    this.attack(nearestHostile);

    nextLoop();
  };

  public equipMeleeWeapon = () => {
    return equipBestToolOfType(this.bot, ['sword', 'axe', 'pickaxe', 'shovel']);
  };

  public attack = (mob: Entity) => {
    this.bot.lookAt(mob.position);
    this.bot.attack(mob);
  };

  /**
   * A rapid melee attack sequence with less checks
   */
  public attackWildly = (mob: Entity) => {
    this.equipMeleeWeapon();

    this.bot.lookAt(mob.position);
    if (!mob.isValid) return;

    if (this.bot.entity.position.distanceTo(mob.position) > 5) {
      this.attackNearest(mob, 7);
      return;
    }
    this.attack(mob);

    setTimeout(() => this.attackWildly(mob), 800);
  };

  public follow = (username = this.defaultTargetPlayer) => {
    const player = this.bot.players[username].entity;

    if (!player) {
      this.bot.chat('I have nobody to follow.');
      return;
    }

    sendChat(this.bot, ChatKeys.follow, {
      replacements: [['username', username]],
    });
    this.bot.chat(`I will follow ${username}`);

    this.bot.pathfinder.setMovements(this.defaultMove);

    this.setBotGoal(new goals.GoalFollow(player, this.range));
  };

  private moveToEntity = (
    entity: Entity,
    deviation = NEAR_RANGE,
    range?: number
  ) => {
    try {
      const { x, y, z } = entity.position;

      return this.toCoordinate({ x, y, z }, deviation, range);
    } catch {}
  };

  public moveToPlayer = (username = this.defaultTargetPlayer) => {
    const player = this.bot.players[username].entity;

    if (!player) {
      this.bot.chat('I have nobody to follow.');
    }

    return this.moveToEntity(player);
  };

  public isPathPossible = (pos: Position) => {
    const path = this.bot.pathfinder.getPathTo(
      new Movements(this.bot),
      new goals.GoalNear(pos.x, pos.y, pos.z, 1)
    );

    return path.status !== 'noPath';
  };

  public stopFollow = () => {
    this.bot.chat('I will stay around here.');

    this.setBotGoal(null);
  };
}
