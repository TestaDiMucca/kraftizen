import path from 'path';
import fs from 'fs';

import Kraftizen from './Kraftizen';
import TeamMessenger from './utils/TeamMessenger';
import {
  AuthTypes,
  KraftizenConfiguration,
  ProcessMessage,
} from './utils/utils.types';
import { performTask } from './actions/performTask';
import { botManagerEvents, EventTypes } from './utils/events';
import { BackoffController } from './utils/BackoffController';
import { onShutdown, slugify } from './utils/utils';
import { readYamlConfig, saveYamlConfig } from './utils/yamlHelpers';

const kraftizenRoster: Record<string, Kraftizen> = {};
const messenger = new TeamMessenger(kraftizenRoster);
const backoffController = new BackoffController();

const kraftizenRepository = path.join(__dirname, 'kraftizens');
const getKraftizenConfigPath = (username: string) =>
  path.join(kraftizenRepository, `ktz-${slugify(username)}.yaml`);

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

  try {
    const loaded = readYamlConfig<KraftizenConfiguration>(
      getKraftizenConfigPath(username)
    );

    if (loaded)
      kraftizenRoster[kraftizenOpts.username]?.statePersister.set(loaded);
  } catch (e) {
    console.error(
      `Could not load kraftizen state for ${username}: ${e.message}`
    );
  }
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

process.on('uncaughtException', (e) => {
  process.send({ type: 'error', error: e.message });
  process.exit(1);
});

/** Establish kraftizen-level listeners */
const main = () => {
  if (!fs.existsSync(kraftizenRepository)) fs.mkdirSync(kraftizenRepository);

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

  onShutdown(() => {
    // save kraftizens state
    Object.values(kraftizenRoster).forEach((kraftizen) => {
      const state = kraftizen.statePersister.get();
      saveYamlConfig(state, getKraftizenConfigPath(kraftizen.username));
    });
  });
};

main();
