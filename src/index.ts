import { performTask } from './utils/actions/tasks';
import Kraftizen from './utils/Kraftizen';

const kraftizenRoster: Kraftizen[] = [];

const botNames = ['Hikori'];

botNames
  .map((username) => ({ host: 'localhost', port: 62228, username }))
  .forEach((kraftizenOpts) => {
    kraftizenRoster.push(new Kraftizen(kraftizenOpts, performTask));
  });
