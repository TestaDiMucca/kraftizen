import { Movements } from 'mineflayer-pathfinder';
import { Entity, KraftizenBot, Persona, Position } from './types';

export const botPosition = (bot: KraftizenBot): Position => {
  const vec = bot.player.entity.position;

  return {
    x: vec.x,
    y: vec.y,
    z: vec.z,
  };
};

export const getKnownHostileMobs = (bot: KraftizenBot) => {
  return Object.values(bot.entities)
    .filter((entity) => entity.kind === 'Hostile mobs')
    .sort((mobA, mobB) => {
      return (
        mobA.position.distanceTo(bot.entity.position) -
        mobB.position.distanceTo(bot.entity.position)
      );
    });
};

export const getNearestHostileMob = (
  bot: KraftizenBot,
  range = 10,
  additionalFilter: (mob: Entity) => boolean = (_) => true
) => {
  const nearestHostiles = getKnownHostileMobs(bot).filter(additionalFilter);

  if (nearestHostiles?.[0]?.position.distanceTo(bot.entity.position) < range) {
    return nearestHostiles[0];
  }
};

/**
 * Personas assigned to task return home when bored
 */
export const personaReturnsHome = (persona: Persona) => {
  return ![Persona.follower, Persona.none].includes(persona);
};

export const getDefaultMovements = (bot: KraftizenBot) => {
  const movement = new Movements(bot);

  movement.canOpenDoors = true;
  movement.digCost = 10;
  movement.placeCost = 3;
  movement.allowEntityDetection = true;

  return movement;
};
