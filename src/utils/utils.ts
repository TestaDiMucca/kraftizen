import { Position } from './types';

export const sleep = (delay: number) =>
  new Promise((resolve) => setTimeout(resolve, delay));

export const getRandomIntInclusive = (min: number, max: number): number => {
  const ceilMin = Math.ceil(min);
  const floorMax = Math.floor(max);

  return Math.floor(Math.random() * (floorMax - ceilMin + 1) + ceilMin);
};

export const calculateDistance3D = (
  point1: Position,
  point2: Position
): number => {
  const deltaX = point2.x - point1.x;
  const deltaY = point2.y - point1.y;
  const deltaZ = point2.z - point1.z;

  return Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
};
