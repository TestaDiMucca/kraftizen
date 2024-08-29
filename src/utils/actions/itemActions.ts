import Kraftizen from '../Kraftizen';
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
    item.name.includes(itemType) ||
    (itemType === 'food' && bot.registry.foodsByName[item.name])
  );
};

const getAllHeldItems = (bot: KraftizenBot) => {
  return [...bot.entity.equipment, bot.inventory.slots].flatMap((i) =>
    !!i ? i : []
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

export const equipBestToolOfType = (bot: KraftizenBot, toolTypes: string[]) => {
  const tools = toolTypes.flatMap((toolType) =>
    equipTiers.map((x) => x + '_' + toolType)
  );

  let equipped = false;
  for (let i = tools.length - 1; i >= 0; i--) {
    const tool = tools[i];

    // TODO: this will equip first match, not best tool.
    let matches = bot.inventory.items().filter((item) => item.name === tool);
    if (matches.length > 0) {
      bot.equip(matches[0], 'hand');

      equipped = true;
      break;
    }
  }

  return equipped;
};

export const hasWeapon = (
  bot: KraftizenBot,
  type: 'melee' | 'ranged' = 'melee'
) => {
  const allItems = getAllHeldItems(bot);

  const searchFor = type === 'melee' ? ['sword', 'axe'] : ['bow'];

  return allItems.some((item) => {
    return searchFor.some((weapon) => item && item.name.includes(weapon));
  });
};

export const withdrawItems = async (
  kraftizen: Kraftizen,
  position: Position
) => {
  const nearbyChest = kraftizen.behaviors.findChest(
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
