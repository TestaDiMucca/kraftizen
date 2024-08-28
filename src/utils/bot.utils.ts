import { KraftizenBot, Position } from './types';

export const botPosition = (bot: KraftizenBot): Position => {
  const vec = bot.player.entity.position;

  return {
    x: vec.x,
    y: vec.y,
    z: vec.z,
  };
};
const equipTiers = [
  'netherite',
  'diamond',
  'iron',
  'stone',
  'wooden',
  'golden',
];

export const equipBestToolOfType = (bot: KraftizenBot, toolType: string) => {
  const tools = equipTiers.map((x) => x + '_' + toolType);

  let equipped = false;
  for (let i = tools.length - 1; i >= 0; i--) {
    const tool = tools[i];

    let matches = bot.inventory.items().filter((item) => item.name === tool);
    console.log(matches, tool, bot.inventory.items());
    if (matches.length > 0) {
      bot.equip(matches[0], 'hand');

      equipped = true;
      break;
    }
  }

  return equipped;
};

export const getNearestHostileMob = (bot: KraftizenBot, range = 10) => {
  const nearestHostiles = Object.values(bot.entities)
    .filter((entity) => entity.kind === 'Hostile mobs')
    .sort((mobA, mobB) => {
      return (
        mobA.position.distanceTo(bot.entity.position) -
        mobB.position.distanceTo(bot.entity.position)
      );
    });

  if (nearestHostiles?.[0].position.distanceTo(bot.entity.position) < range) {
    return nearestHostiles[0];
  }
};
