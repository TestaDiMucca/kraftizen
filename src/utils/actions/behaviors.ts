import { goals, Movements } from 'mineflayer-pathfinder';
import { Entity, KraftizenBot, Position } from '../types';
import { calculateDistance3D, getRandomIntInclusive } from '../utils';
import {
  botPosition,
  equipBestToolOfType,
  getNearestHostileMob,
} from '../bot.utils';
import { PATH_FINDING_TIMEOUT, RANGE } from '../constants';

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
    deviation = 0
  ): Promise<boolean> => {
    return new Promise(async (resolve) => {
      try {
        let timeElapsed = 0;
        const onGoalReached = (gaveUp = false) => {
          // this.bot.off('goal_reached', onGoalReached);
          if (posTest) clearInterval(posTest);
          resolve(!gaveUp);
        };

        const offset =
          deviation > 0 ? getRandomIntInclusive(-deviation, deviation) : 0;

        const goal = new goals.GoalNear(
          position.x + offset,
          position.y,
          position.z + offset,
          NEAR_RANGE
        );

        this.bot.pathfinder.goto(goal);

        const posTest = setInterval(() => {
          if (timeElapsed > GOAL_GIVE_UP_TIME) {
            onGoalReached(true);
            return;
          }
          const distance = calculateDistance3D(
            { x: position.x, y: position.y, z: position.z },
            botPosition(this.bot)
          );

          if (distance < NEAR_RANGE * 2) {
            onGoalReached(false);
            clearInterval(posTest);
          }
          timeElapsed += GOAL_POLL_INTERVAL;
        }, GOAL_POLL_INTERVAL);
      } catch (e) {
        resolve(false);
      }
    });
  };

  public toPlayer = (username: string) => {
    const player = this.bot.players[username].entity;

    if (!player) {
      this.bot.chat('I have nobody to follow.');
    }

    this.bot.chat('Coming!');

    this.toCoordinate(
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

    // TODO: Support list of tools
    const equipped = equipBestToolOfType(this.bot, 'sword');
    if (!equipped) equipBestToolOfType(this.bot, 'axe');

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
    this.bot.attack(mob);
  };

  public follow = (username = this.defaultTargetPlayer) => {
    const player = this.bot.players[username].entity;

    if (!player) {
      this.bot.chat('I have nobody to follow.');
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
