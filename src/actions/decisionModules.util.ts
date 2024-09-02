import Kraftizen from '../Kraftizen';
import { Block, Entity, Item, Position } from '../utils/types';
import { Task } from './performTask';

/**
 * Decision modules are little tasks that kraftizens can decide to do
 * as opposed to something they've explicitly been commanded to do. Tasks
 * can overlap with orders but likely both queue actions of some sort.
 */
export type DecisionModule = {
  name: string;
  /** 0-1 */
  chance?: number;
  criteria?: (context: Context) => boolean | Promise<boolean>;
  action: (context: Context) => void | Promise<void>;
  /** Allow evaluating other modules even if this one triggers */
  continue?: boolean;
} & ({} | {});

export type DecisionModuleFactory = (...args: any[]) => DecisionModule;

type Context = {
  kraftizen: Kraftizen;
  distanceFromHome: number;
  targetPos?: Position;
  targetBlock?: Block;
  targetItem?: Item;
  targetEnemy?: Entity;
};

/**
 * Temp keys are references stored in the criteria test and passed to action
 * We should remove them for the next round of actions.
 */
const tempKeys: Array<keyof Context> = [
  'targetBlock',
  'targetItem',
  'targetPos',
  'targetEnemy',
];

/**
 * Decision modules are evaluated in sequence so it is important to
 * input by priority, and make sure there are conditions where if a module
 * is not run, chance or criteria should allow it to fall through
 *
 * Sometimes tasks are run inline here instead of spawning an async task for the task queue
 * A decision to be made is if they should all be migrated to async task. The queue can bloat,
 * so likely we'll keep putting async type tasks there, else the bot may never do its job function
 */
export const processDecisionModules = async (
  kraftizen: Kraftizen,
  decisionModules: DecisionModule[]
) => {
  const context: Context = {
    kraftizen,
    distanceFromHome: kraftizen.distanceFromHome(),
  };

  for (let i = 0; i < decisionModules.length; i++) {
    const dm = decisionModules[i];

    const chanceGate = dm.chance ? Math.random() < dm.chance : true;
    const criteriaGate = dm.criteria ? await dm.criteria(context) : true;

    if (chanceGate && criteriaGate) {
      kraftizen.tasks.currentTask = {
        type: Task.personaTask,
        description: dm.name,
      };
      await dm.action(context);
      kraftizen.tasks.currentTask = null;
      if (!dm.continue) break;
    }

    /** Clear context items that were meant to pass from criteria to action */
    tempKeys.forEach((key) => {
      if (context[key]) delete context[key];
    });
  }
};
