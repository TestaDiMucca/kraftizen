import mineflayer from 'mineflayer';

export type KraftizenBot = mineflayer.Bot;

export type Position = {
  x: number;
  y: number;
  z: number;
};

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
}
