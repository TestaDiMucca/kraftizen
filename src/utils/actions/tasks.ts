import Kraftizen from '../Kraftizen';
import { Entity, Position } from '../types';

export enum Task {
  come = 'come',
  hunt = 'hunt',
  return = 'return',
  visit = 'visit',
  collect = 'collect',
}

export type TaskPayload =
  | {
      type: Task.come;
      username: string;
      oneTime?: boolean;
    }
  | {
      type: Task.visit;
      position: Position;
    }
  | { type: Task.hunt; entity?: Entity; silent?: boolean }
  | {
      type: Task.return | Task.collect;
    };

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
        await behaviors.attackNearest(task.entity, 30, !task.silent);
        break;
      case Task.return:
        bot.chat('I will return to where I came from.');
        await behaviors.toCoordinate(kraftizen.homePoint);
        break;
      case Task.visit:
        await behaviors.toCoordinate(task.position, 0);
        break;
      case Task.collect:
        const items = await behaviors.getItems((item) => {
          kraftizen.addTask({
            type: Task.visit,
            position: item.position,
          });
        });

        if (items === 0) bot.chat('Nothing to collect');
        break;
      default:
    }
  } catch (e) {
  } finally {
    kraftizen.finishCurrentTask();
    console.debug('finishing task', task.type);
  }
};
