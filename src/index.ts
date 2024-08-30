import { performTask } from './utils/actions/performTask';
import Kraftizen from './utils/Kraftizen';
import TeamMessenger from './utils/TeamMessenger';

const kraftizenRoster: Kraftizen[] = [];

const botNames = ['Kazuma', 'Miko', 'Nakanaka', 'Gilbert'];

const messenger = new TeamMessenger(kraftizenRoster);

botNames
  .map((username) => ({ host: 'localhost', port: 62228, username, messenger }))
  .forEach((kraftizenOpts) => {
    kraftizenRoster.push(new Kraftizen(kraftizenOpts, performTask));
  });
