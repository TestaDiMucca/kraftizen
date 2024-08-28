import { performTask } from './utils/actions/performTask';
import Kraftizen from './utils/Kraftizen';

const kraftizenRoster: Kraftizen[] = [];

const botNames = ['Kazuma', 'Miko', 'Nakanaka', 'Gilbert'];

botNames
  .map((username) => ({ host: 'localhost', port: 62228, username }))
  .forEach((kraftizenOpts) => {
    kraftizenRoster.push(new Kraftizen(kraftizenOpts, performTask));
  });
