import { Movements } from 'mineflayer-pathfinder';
import { Entity, KraftizenBot, Persona, Position } from './types';
import { Vec3 } from 'vec3';

export const botPosition = (bot: KraftizenBot): Position => {
  const vec = bot.player.entity.position;

  return {
    x: vec.x,
    y: vec.y,
    z: vec.z,
  };
};

/**
 * Known hostiles sorted by distance from the bot
 */
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

export const vec3ToPosition = (vec3: Vec3) => ({
  x: vec3.x,
  y: vec3.y,
  z: vec3.z,
});

export const positionToVec3 = (pos: Position) =>
  pos instanceof Vec3 ? pos : new Vec3(pos.x, pos.y, pos.z);

export const canSeeCoordinate = (bot: KraftizenBot, position: Position) => {
  const block = bot.blockAt(positionToVec3(position), true);
  return bot.canSeeBlock(block);
};

export const getCardinalDirection = (from: Position, to: Position): string => {
  const dx = to.x - from.x;
  const dz = to.z - from.z;

  if (dx === 0 && dz === 0) {
    return 'You are at the same location.';
  }

  const directions = [];

  if (dz > 0) {
    directions.push('south');
  } else if (dz < 0) {
    directions.push('north');
  }

  if (dx > 0) {
    directions.push('east');
  } else if (dx < 0) {
    directions.push('west');
  }

  return directions.join('');
};

export const checkIfBedIsOccupied = (bot: KraftizenBot, bedBlock) => {
  try {
    const state = bot.blockAt(bedBlock.position);

    const stateProperties = state.getProperties();

    if (state && stateProperties?.occupied === false) {
      return false;
    } else {
      return true;
    }
  } catch {
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
  movement.placeCost = 30;
  movement.allowEntityDetection = true;

  return movement;
};

export const isNight = (time: number) =>
  time >= 12542 && time <= 23458 ? true : false;
