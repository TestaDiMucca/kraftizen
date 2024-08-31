import Kraftizen from '../../Kraftizen';

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

type Context = {
  kraftizen: Kraftizen;
  distanceFromHome: number;
};

/**
 * Decision modules are evaluated in sequence so it is important to
 * input by priority, and make sure there are conditions where if a module
 * is not run, chance or criteria should allow it to fall through
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
      await dm.action(context);
      if (!dm.continue) break;
    }
  }
};
