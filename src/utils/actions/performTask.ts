import Kraftizen from '../Kraftizen';
import { ChestItemClass, Entity, Position } from '../types';
import { posString } from '../utils';
import { withdrawItems } from './itemActions';

export enum Task {
  come = 'come',
  hunt = 'hunt',
  return = 'return',
  visit = 'visit',
  collect = 'collect',
  withdraw = 'withdraw',
  findChest = 'find a chest',
  goto = 'travel',
  setHome = 'set home',
}

type TaskPayloadCommon = { verbose?: boolean };

type TaskPayloadByType =
  | {
      type: Task.come;
      username: string;
      oneTime?: boolean;
    }
  | {
      type: Task.findChest;
      verbose?: boolean;
      withdraw?: boolean;
      multiple?: boolean;
      visited?: Set<string>;
    }
  | {
      type: Task.withdraw;
      itemClass?: ChestItemClass;
      verbose?: boolean;
      position?: Position;
    }
  | {
      type: Task.visit;
      position: Position;
    }
  | { type: Task.hunt; entity?: Entity; verbose?: boolean }
  | {
      type: Task.return | Task.collect | Task.setHome;
    };

export type TaskPayload = TaskPayloadByType & TaskPayloadCommon;

export const performTask = async (task: TaskPayload, kraftizen: Kraftizen) => {
  const { type } = task;
  const { behaviors, bot } = kraftizen;

  console.debug('starting task', task);
  try {
    switch (type) {
      case Task.come:
        if (task.oneTime) bot.chat(`Coming, ${task.username}`);
        await behaviors.toPlayer(task.username);
        break;
      case Task.hunt:
        await behaviors.attackNearest(task.entity, 30, task.verbose);
        break;
      case Task.return:
        await behaviors.toCoordinate(kraftizen.homePoint);
        break;
      case Task.visit:
        // todo: test path
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
      case Task.findChest: {
        const visited = task.visited ?? new Set<string>();
        const chest = await behaviors.goToChest(undefined, visited);

        if (chest && task.withdraw) {
          if (task.multiple) {
            visited.add(posString(chest.position));
            kraftizen.addTask({
              type: Task.findChest,
              verbose: task.verbose,
              withdraw: task.withdraw,
              visited,
            });
          }
          kraftizen.addTask({
            type: Task.withdraw,
            verbose: task.verbose,
            position: chest.position,
          });
        } else if (task.verbose && visited.size === 0)
          bot.chat('I see no chests nearby');
        break;
      }
      case Task.withdraw:
        const withdrawCount = await withdrawItems(kraftizen, task.position);
        if (task.verbose) bot.chat(`I got ${withdrawCount} items`);
        break;
      case Task.setHome:
        kraftizen.setHome();
        break;
      default:
    }
  } catch (e) {
  } finally {
    kraftizen.finishCurrentTask();
    console.debug('finishing task', task.type);
  }
};
