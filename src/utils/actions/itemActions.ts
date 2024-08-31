import Kraftizen from '../../Kraftizen';
import { KraftizenBot, Position } from '../types';
import { sleep } from '../utils';

const searchItems = [
  'food',
  'sword',
  'pickaxe',
  'helmet',
  'chestplate',
  'leggings',
  'boots',
  'axe',
  'bow',
  'crossbow',
  'arrow',
];

const keep = ['food', 'arrow'];

const maxWithdraw = 10;
const maxToWithdrawOverrides: Record<string, number> = {
  arrow: 64,
};
const rangeToChestOpen = 3;

type Item = KraftizenBot['inventory']['slots'][number];

/**
 * If an item matches a given category that the bot "should" have
 */
const itemMatches = (bot: KraftizenBot, itemType: string, item: Item) => {
  return (
    item &&
    (item.name.includes(itemType) ||
      (itemType === 'food' && bot.registry.foodsByName[item.name]))
  );
};

const getAllHeldItems = (bot: KraftizenBot, equip: boolean = true) => {
  return [...(equip ? bot.entity.equipment : []), bot.inventory.slots].flatMap(
    (i) => (!!i ? i : [])
  );
};

const equipTiers = [
  'netherite',
  'diamond',
  'iron',
  'stone',
  'wooden',
  'golden',
];

export const getFood = async (bot: KraftizenBot) => {
  const list = getAllHeldItems(bot);
  return list.find((item) => item && itemMatches(bot, 'food', item));
};

export const equipRanged = async (bot: KraftizenBot) => {
  let matches = bot.inventory
    .items()
    .filter((item) => item.name === 'bow' || item.name === 'crossbow');
  if (matches.length > 0) {
    bot.equip(matches[0], 'hand');
  }

  return matches[0].name;
};

export const equipBestToolOfType = (bot: KraftizenBot, toolTypes: string[]) => {
  const tools = toolTypes.flatMap((toolType) =>
    equipTiers.map((x) => x + '_' + toolType)
  );

  let equipped: Item | null = null;
  for (let i = tools.length - 1; i >= 0; i--) {
    const tool = tools[i];

    // TODO: this will equip first match, not best tool.
    let matches = bot.inventory.items().filter((item) => item.name === tool);
    if (matches.length > 0) {
      bot.equip(matches[0], 'hand');

      equipped = matches[0];
      break;
    }
  }

  return equipped;
};

export const hasWeapon = (
  bot: KraftizenBot,
  type: 'melee' | 'ranged' | 'arrow' = 'melee'
) => {
  const allItems = getAllHeldItems(bot);

  const searchFor =
    type === 'melee'
      ? ['sword', 'axe']
      : type === 'arrow'
      ? ['arrow']
      : ['bow'];

  return allItems.some((item) => {
    return searchFor.some((weapon) => item && item.name.includes(weapon));
  });
};

export const depositItems = async (
  kraftizen: Kraftizen,
  position: Position
) => {
  const nearbyChest = kraftizen.behaviors.findBlock(
    rangeToChestOpen,
    undefined,
    undefined,
    position
  );

  if (!nearbyChest) return;

  await kraftizen.bot.lookAt(nearbyChest.position);

  const chest = await kraftizen.bot.openContainer(nearbyChest);

  if (!chest) return;

  await sleep(1000);
  const allItems = getAllHeldItems(kraftizen.bot, false);
  const depositList = allItems.filter(
    (item) =>
      !keep.some(
        (itemType) => item && itemMatches(kraftizen.bot, itemType, item)
      )
  );

  let depositCount = 0;
  for (let i = 0; i < depositList.length; i++) {
    const item = depositList[i];
    if (!item) continue;

    try {
      await chest.deposit(item.type, null, item.count);
      depositCount++;
    } catch (e) {
      console.error('deposit error', e);
      break;
    }
  }

  await chest.close();

  return depositCount;
};

export const withdrawItems = async (
  kraftizen: Kraftizen,
  position: Position
) => {
  const nearbyChest = kraftizen.behaviors.findBlock(
    rangeToChestOpen,
    undefined,
    undefined,
    position
  );

  if (!nearbyChest) return;

  await kraftizen.bot.lookAt(nearbyChest.position);

  const chest = await kraftizen.bot.openContainer(nearbyChest);

  if (!chest) return;

  await sleep(1000);
  const toSearch = new Set(searchItems);
  const allItems = getAllHeldItems(kraftizen.bot);

  allItems.forEach((item) => {
    if (!item) return;

    toSearch.forEach((itemType) => {
      if (itemMatches(kraftizen.bot, itemType, item)) {
        // have it, don't need
        toSearch.delete(itemType);
      }
    });
  });

  /**
   * No bow, don't take arrows
   * we might take a bow tho, and then not arrows
   */
  if (
    !toSearch.has('bow') &&
    !toSearch.has('crossbow') &&
    toSearch.has('arrow')
  )
    toSearch.delete('arrow');

  const allChestItems = chest.containerItems();

  const typesToWithDraw: Array<{ type: number; count: number; name: string }> =
    [];
  allChestItems.forEach((chestItem) => {
    toSearch.forEach((itemType) => {
      if (itemMatches(kraftizen.bot, itemType, chestItem)) {
        typesToWithDraw.push({
          type: chestItem.type,
          name: chestItem.name,
          count: chestItem.count,
        });
        toSearch.delete(itemType);
      }
    });
  });

  let withdrawCount = 0;

  for (let i = 0; i < typesToWithDraw.length; i++) {
    try {
      const { type, count, name } = typesToWithDraw[i];
      await chest.withdraw(
        type,
        null,
        Math.min(count, maxToWithdrawOverrides[name] ?? maxWithdraw)
      );
      withdrawCount++;
    } catch (e) {
      console.error('withdraw error', e);
    }
  }

  await chest.close();

  return withdrawCount;
};
