import { goals, Movements } from 'mineflayer-pathfinder';
import { Entity, KraftizenBot, Position } from '../types';
import {
  calculateDistance3D,
  getRandomIntInclusive,
  posString,
} from '../utils';
import { botPosition, getNearestHostileMob } from '../bot.utils';
import { PATH_FINDING_TIMEOUT, RANGE } from '../constants';
import { Vec3 } from 'vec3';
import { equipBestToolOfType } from './itemActions';

const NEAR_RANGE = 2;
const GOAL_POLL_INTERVAL = 500;
const GOAL_GIVE_UP_TIME = PATH_FINDING_TIMEOUT;

type BehaviorsEngineOpts = {
  defaultMove: Movements;
  bot: KraftizenBot;
  defaultTargetPlayer: string | null;
  range?: number;
};

export default class BehaviorsEngine {
  defaultMove: Movements;
  bot: KraftizenBot;
  defaultTargetPlayer: string | null = null;
  range = RANGE;

  constructor(opts: BehaviorsEngineOpts) {
    this.defaultMove = opts.defaultMove;
    this.bot = opts.bot;
    this.defaultTargetPlayer = opts.defaultTargetPlayer;
  }

  private setBotGoal = (goal: goals.Goal) => {
    if (this.bot.pathfinder.goal) this.bot.pathfinder.setGoal(null);

    if (!goal) return;

    this.bot.pathfinder.setGoal(goal, true);
  };

  public toCoordinate = async (
    position: Position,
    /** Randomness in goal */
    deviation = 0,
    /** Navigate to this many blocks away */
    nearRange = 1
  ): Promise<boolean> => {
    return new Promise(async (resolve) => {
      try {
        let timeElapsed = 0;
        const onGoalReached = (gaveUp = false) => {
          if (posTest) clearInterval(posTest);
          resolve(!gaveUp);
        };

        const offset =
          deviation > 0 ? getRandomIntInclusive(-deviation, deviation) : 0;

        const goal = new goals.GoalNear(
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
          if (timeElapsed > GOAL_GIVE_UP_TIME) {
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

  public findChest = (
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

    const allChests = this.bot.findBlocks({
      matching: blocks.map((name) => this.bot.registry.blocksByName[name].id),
      maxDistance: range,
      count: 5,
    });

    const filtered = allChests.filter(
      (chest) => !visited.has(posString(chest))
    );

    if (filtered.length === 0) return null;

    return this.bot.blockAt(filtered[0]);
  };

  public goToChest = async (
    blocks = ['chest', 'barrel'],
    visited: Set<string> = new Set()
  ) => {
    const chestToOpen = this.findChest(this.range, blocks, visited);

    if (!chestToOpen) return;

    await this.toCoordinate(chestToOpen.position, 0, 2);

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

  /** Get nearby items */
  public getItems = async (onItem: (entity: Entity) => void) => {
    // TODO: someday communicate across kraftizens if they marked an item to collect
    const drops = Object.values(this.bot.entities)
      .filter((entity) => entity.name === 'item')
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

    drops.forEach((drop) => onItem(drop));

    return drops.length;
  };

  public attackNearest = async (
    target?: Entity,
    range?: number,
    chat = false
  ) => {
    if (this.bot.pathfinder.goal) return;

    const nearestHostile =
      target ?? getNearestHostileMob(this.bot, range ?? this.range);

    if (!nearestHostile) {
      if (chat) this.bot.chat('Looks like nothing nearby');
      return;
    }

    equipBestToolOfType(this.bot, ['sword', 'axe', 'pickaxe', 'shovel']);

    this.bot.lookAt(nearestHostile.position);

    if (chat) this.bot.chat(`Begone, ${nearestHostile.name ?? 'fiend'}!`);

    await this.moveToEntity(nearestHostile);

    if (chat) this.bot.chat('En garde!');

    this.attack(nearestHostile);

    if (nearestHostile.isValid)
      setTimeout(() => this.attackNearest(nearestHostile), 500);
    else {
      if (chat) this.bot.chat('All too easy');
    }
  };

  private attack = (mob: Entity) => {
    this.bot.lookAt(mob.position);
    this.bot.attack(mob);
  };

  public follow = (username = this.defaultTargetPlayer) => {
    const player = this.bot.players[username].entity;

    if (!player) {
      this.bot.chat('I have nobody to follow.');
      return;
    }

    this.bot.chat(`I will follow ${username}`);

    this.bot.pathfinder.setMovements(this.defaultMove);

    this.setBotGoal(new goals.GoalFollow(player, this.range));
  };

  private moveToEntity = (entity: Entity) => {
    try {
      const { x, y, z } = entity.position;

      return this.toCoordinate({ x, y, z }, NEAR_RANGE);
    } catch {}
  };

  public moveToPlayer = (username = this.defaultTargetPlayer) => {
    const player = this.bot.players[username].entity;

    if (!player) {
      this.bot.chat('I have nobody to follow.');
    }

    return this.moveToEntity(player);
  };

  public stopFollow = () => {
    this.bot.chat('I will stay around here.');

    this.setBotGoal(null);
  };
}
