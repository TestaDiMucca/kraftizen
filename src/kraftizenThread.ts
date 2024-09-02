import Kraftizen from './Kraftizen';
import TeamMessenger from './utils/TeamMessenger';
import { AuthTypes, ProcessMessage } from './utils/utils.types';
import { performTask } from './actions/performTask';
import { botManagerEvents, EventTypes } from './utils/events';
import { BackoffController } from './utils/BackoffController';

const kraftizenRoster: Record<string, Kraftizen> = {};
const messenger = new TeamMessenger(kraftizenRoster);
const backoffController = new BackoffController();

let host = 'localhost';
let port = 62228;
let auth: AuthTypes = 'offline';

const addKraftizen = (username: string) => {
  const kraftizenOpts = {
    host,
    port,
    username,
    messenger,
    auth,
  };
  kraftizenRoster[kraftizenOpts.username] = new Kraftizen(
    kraftizenOpts,
    performTask
  );
};

process.on('message', (message: ProcessMessage) => {
  switch (message.type) {
    case 'create':
      console.log(`${process.ppid}: Creating ${message.username}`);
      addKraftizen(message.username);
      break;
    case 'config':
      port = message.port;
      host = message.host;
      auth = message.auth;
      break;
    case 'teamMessage':
      messenger.onTeamMessage(message.message);
      break;
    default:
  }
});

/** Establish kraftizen-level listeners */
const main = () => {
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
