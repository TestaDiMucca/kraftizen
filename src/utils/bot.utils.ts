import { KraftizenBot, Persona, Position } from './types';

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

export const getNearestHostileMob = (bot: KraftizenBot, range = 10) => {
  const nearestHostiles = getKnownHostileMobs(bot);

  if (nearestHostiles?.[0].position.distanceTo(bot.entity.position) < range) {
    return nearestHostiles[0];
  }
};

/**
 * Personas assigned to task return home when bored
 */
export const personaReturnsHome = (persona: Persona) => {
  return ![Persona.follower, Persona.none].includes(persona);
};
