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

export const posString = ({ x, y, z }: Position) => `${x},${y},${z}`;

export const randomFromArray = <T>(arr: T[]) =>
  arr[Math.floor(Math.random() * arr.length)];

export const logPrimitives = (...args: any[]): void => {
  const processedArgs = [];
  args.forEach((arg) => {
    if (arg !== Object(arg)) {
      processedArgs.push(arg);
    } else if (typeof arg === 'object' && arg !== null) {
      const filteredObject = {};
      for (const [key, value] of Object.entries(arg)) {
        if (value !== Object(value)) {
          filteredObject[key] = value;
        }
      }
      processedArgs.push(filteredObject);
    }
  });

  console.debug(...processedArgs);
};

const isObject = (item: any): boolean => {
  return item && typeof item === 'object' && !Array.isArray(item);
};

export const deepMerge = <T extends object>(target: T, ...sources: T[]): T => {
  if (!sources.length) return target;

  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key] as object, source[key] as object);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
};

const shutdownCbs: Array<() => void> = [];

export const onShutdown = (cb: () => void) => {
  shutdownCbs.push(cb);
};

/** Add actual shutdown listeners */
['SIGTERM', 'SIGINT', 'exit'].forEach((signal) =>
  process.on(signal, () => {
    shutdownCbs.forEach((cb) => cb());
    process.exit();
  })
);

export const slugify = (text: string): string => {
  return (
    text
      // Convert to lowercase
      .toLowerCase()
      // Replace spaces with -
      .replace(/\s+/g, '-')
      // Remove all non-word chars except for - and _
      .replace(/[^a-z0-9\-_]+/g, '')
      // Replace multiple - or _ with a single -
      .replace(/-+/g, '-')
      // Trim - from start and end of text
      .trim()
  );
};
