import mineflayer from 'mineflayer';

/**
 * In case we need to extend due to plugins such as collector
 */
export type KraftizenBot = mineflayer.Bot & {
  autoEat?: {
    enable: () => void;
    disable: () => void;
  };
};

/**
 * Minimum subset of Entity.position
 */
export type Position = {
  x: number;
  y: number;
  z: number;
};

/**
 * Generic entity attached to all things in game
 */
export type Entity = mineflayer.Bot['entity'];

export enum KraftizenState {}

export enum Persona {
  /** Use only default behaviors */
  none = 'normal',
  guard = 'guard',
  farmer = 'farmer',
  lookout = 'lookout',
  miner = 'miner',
  follower = 'follower',
  loot = 'loot',
}

/**
 * Types of items a bot should take from a chest
 */
export type ChestItemClass = 'food' | 'armor' | 'weapon';
