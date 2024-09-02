/** Standard range to look for stuff */
export const RANGE = 30;

/** How far to stray from home range if doing normal duties */
export const HOME_RANGE = 100;

/** How long before giving up on path finding */
export const PATH_FINDING_TIMEOUT = 10 * 1000;

/** Some starter names */
export const DEFAULT_NAMES = [
  'Kazuma',
  'Miko',
  'Sein',
  'Gilbert',
  'Caesar',
  'Kaguya',
];

/** How near to a chest to open it */
export const RANGE_CHEST_OPEN = 2;

/** Never take more of this count from chest unless otherwise specified */
export const MAX_WITHDRAW = 10;

/** How near to start melee attacking */
export const MELEE_RANGE = 4;

/** Auto withdraw if less slots free than this */
export const INVENTORY_SLOTS_ALLOWED = 4;

/** How far to start shooting. Keep small, aim is bad */
export const SHOOT_RANGE = 10;

/**
 * How often we check if a target is reached.
 * Necessary because thr goal_reached event often does not fire
 */
export const GOAL_POLL_INTERVAL = 500;

/** How close do we consider something near enough to interact with */
export const NEAR_RANGE = 2;

/** How long to wait for a chat response */
export const DEFAULT_CHAT_WAIT = 1000 * 20;

/** How many threads to split bots across */
export const DEFAULT_THREADS = 2;

/** What file to save the config */
export const CONF_NAME = 'configuration.yaml';
