import applyArcher from './archer';
import applyDigger from './digger';
import applyFarmer from './farmer';
import applyGuard from './guard';
import applyInventory from './inventory';

/**
 * Don't actually use these. These are for reference/experiments.
 */
const defaultPersonas = {
  digger: applyDigger,
  archer: applyArcher,
  farmer: applyFarmer,
  guard: applyGuard,
  inventory: applyInventory,
};

export default defaultPersonas;
