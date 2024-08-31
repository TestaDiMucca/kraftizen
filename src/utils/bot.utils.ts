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

export const checkIfBedIsOccupied = (bot: KraftizenBot, bedBlock) => {
  const state = bot.blockAt(bedBlock.position);

  if (state && state.stateId && state.stateId === 1695) {
    return false;
  } else {
    return true;
  }
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
  movement.digCost = 500;
  movement.placeCost = 3;
  movement.allowEntityDetection = true;
  // movement.canDig = false;

  return movement;
};

export const isNight = (time: number) =>
  time >= 12542 && time <= 23458 ? true : false;
