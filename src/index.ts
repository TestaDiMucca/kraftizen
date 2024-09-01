import { performTask } from './actions/performTask';
import Kraftizen from './Kraftizen';
import TeamMessenger from './utils/TeamMessenger';

const kraftizenRoster: Kraftizen[] = [];

const botNames = ['Kazuma', 'Miko', 'Sein', 'Gilbert'];

const messenger = new TeamMessenger(kraftizenRoster);

botNames
  .map((username) => ({ host: 'localhost', port: 62228, username, messenger }))
  .forEach((kraftizenOpts) => {
    kraftizenRoster.push(new Kraftizen(kraftizenOpts, performTask));
  });
