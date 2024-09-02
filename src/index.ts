import { performTask } from './actions/performTask';
import Kraftizen from './Kraftizen';
import { BackoffController } from './utils/BackoffController';
import { DEFAULT_NAMES } from './utils/constants';
import { botManagerEvents, EventTypes } from './utils/events';
import TeamMessenger from './utils/TeamMessenger';

const kraftizenRoster: Record<string, Kraftizen> = {};
const messenger = new TeamMessenger(kraftizenRoster);
const backoffController = new BackoffController();

const count = Math.min(parseInt(process.argv[2] ?? '4'), 10);

console.log('Start with bot count:', count);

const addKraftizen = (username: string) => {
  const kraftizenOpts = { host: 'localhost', port: 62228, username, messenger };
  kraftizenRoster[kraftizenOpts.username] = new Kraftizen(
    kraftizenOpts,
    performTask
  );
};

const main = () => {
  for (let i = 0; i < count; i++) {
    const name = DEFAULT_NAMES[i] ?? `SYNTHETIC-KTZ-${i}`;

    addKraftizen(name);
  }

  botManagerEvents.on(EventTypes.botError, (message) => {
    if (!kraftizenRoster[message.botName]) return;
    kraftizenRoster[message.botName].shutDown();

    delete kraftizenRoster[message.botName];

    const delay = backoffController.nextDelay(message.botName);

    if (delay === null) {
      console.log(
        `No longer trying to respawn ${message.botName}. Error: ${message.error}`
      );
      return;
    }
    setTimeout(() => {
      addKraftizen(message.botName);
    }, delay);
  });
};

main();
