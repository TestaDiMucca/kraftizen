import Kraftizen from '../Kraftizen';
import { ChestItemClass, Entity, Position } from '../utils/types';
import { logPrimitives, posString } from '../utils/utils';
import { depositItems, withdrawItems } from './itemActions';

export enum Task {
  come = 'come',
  hunt = 'hunt',
  return = 'return',
  visit = 'visit',
  collect = 'collect',
  withdraw = 'withdraw',
  findBlock = 'find a chest',
  setHome = 'set home',
  deposit = 'deposit',
  sleep = 'sleep',
  eat = 'eat',
  personaTask = 'personaTask',
}

type TaskPayloadCommon = { verbose?: boolean; range?: number };

type TaskPayloadByType =
  | {
      type: Task.come;
      username: string;
      oneTime?: boolean;
      setHome?: boolean;
    }
  | {
      type: Task.findBlock;
      verbose?: boolean;
      withdraw?: boolean | string[];
      deposit?: boolean;
      multiple?: boolean;
      blockNames?: string[];
      visited?: Set<string>;
    }
  | {
      type: Task.withdraw;
      items?: string[];
      verbose?: boolean;
      position?: Position;
    }
  | { type: Task.deposit; position?: Position }
  | {
      type: Task.visit;
      position: Position;
    }
  | {
      type: Task.hunt;
      entity?: Entity;
      verbose?: boolean;
      forceMelee?: boolean;
    }
  | {
      type: Task.return | Task.collect | Task.setHome | Task.sleep | Task.eat;
    }
  | {
      type: Task.personaTask;
      description: string;
    };

export type TaskPayload = TaskPayloadByType & TaskPayloadCommon;

export const performTask = async (task: TaskPayload, kraftizen: Kraftizen) => {
  const { type } = task;
  const { behaviors, bot } = kraftizen;

  logPrimitives(bot.username, 'starting task', task);
  try {
    switch (type) {
      case Task.come:
        if (task.oneTime) bot.chat(`Coming, ${task.username}`);
        await behaviors.toPlayer(task.username);
        if (task.setHome) kraftizen.setHome();
        break;
      case Task.eat:
        await behaviors.eat();
        break;
      case Task.hunt:
        await behaviors.attackNearest(
          task.entity,
          30,
          task.verbose,
          task.forceMelee
        );
        break;
      case Task.return:
        await behaviors.toCoordinate(kraftizen.homePoint);
        break;
      case Task.visit:
        const possible = behaviors.isPathPossible(task.position);

        if (!possible) {
          bot.chat('I cannot get there');
          break;
        }
        await behaviors.toCoordinate(task.position, 0);
        break;
      case Task.collect:
        const items = await behaviors.getItems((item) => {
          kraftizen.addTask({
            type: Task.visit,
            position: item.position,
          });
        });

        if (items === 0 && task.verbose) bot.chat('Nothing to collect');
        break;
      case Task.sleep:
        kraftizen.tasks.removeTasksOfType(Task.sleep);
        await kraftizen.behaviors.goSleep();
        break;
      case Task.findBlock: {
        const visited = task.visited ?? new Set<string>();
        const chest = await behaviors.goToChest(
          task.blockNames ?? ['chest', 'barrel'],
          visited,
          task.range
        );

        if (chest) {
          if (task.multiple && task.withdraw) {
            visited.add(posString(chest.position));
            kraftizen.addTask({
              type: Task.findBlock,
              verbose: task.verbose,
              withdraw: task.withdraw,
              visited,
            });
          }
          if (task.withdraw)
            kraftizen.addTask({
              type: Task.withdraw,
              verbose: task.verbose,
              position: chest.position,
              ...(Array.isArray(task.withdraw)
                ? {
                    items: task.withdraw,
                  }
                : {}),
            });

          if (task.deposit)
            kraftizen.addTask({
              type: Task.deposit,
              position: chest.position,
              verbose: task.verbose,
            });
        } else if (task.verbose && visited.size === 0)
          bot.chat('I see no chests nearby');
        break;
      }
      case Task.deposit:
        const depositCount = await depositItems(kraftizen, task.position);
        if (task.verbose) bot.chat(`I stored ${depositCount} items`);
        break;
      case Task.withdraw:
        const withdrawCount = await withdrawItems(
          kraftizen,
          task.position,
          task.items
        );
        if (task.verbose) bot.chat(`I got ${withdrawCount} items`);
        break;
      case Task.setHome:
        kraftizen.setHome();
        break;
      default:
    }
  } catch (e) {
  } finally {
    kraftizen.tasks.finishCurrentTask();
    console.debug(bot.username, 'finishing task', task.type);
  }
};
