import { ChildProcess, fork } from 'child_process';
import path from 'path';

import { DEFAULT_THREADS, DEFAULT_NAMES, CONF_NAME } from './utils/constants';
import { Configuration, ProcessMessage } from './utils/utils.types';
import { onShutdown } from './utils/utils';
import { readYamlConfig, saveYamlConfig } from './utils/yamlHelpers';

const count = Math.min(parseInt(process.argv[2] ?? '4'), 10);

console.log('[main] start with bot count:', count);

const childProcesses: ChildProcess[] = [];
const confFilePath = path.join(__dirname, CONF_NAME);

const messageChild = (child: ChildProcess, message: ProcessMessage) => {
  child.send(message);
};

let configuration: Partial<Configuration> = {
  host: 'localhost',
  port: 62228,
  names: DEFAULT_NAMES,
};

const setupChild = (id: number) => {
  const child = fork(path.join(__dirname, './kraftizenThread.ts'));

  child.on('spawn', () => {
    const { host, port } = configuration;
    messageChild(child, {
      type: 'config',
      host,
      port,
      id,
    });
  });

  child.on('message', (message: ProcessMessage) => {
    switch (message.type) {
      case 'teamMessage':
        childProcesses.forEach((child) => messageChild(child, message));
        break;
      default:
    }
  });

  child.on('exit', (code) => {
    console.log(`[main] Child process exited with code ${code}`);
  });

  childProcesses.push(child);
};

const loadConfiguration = () => {
  try {
    const loadedConfig = readYamlConfig<Configuration>(confFilePath);

    if (loadedConfig)
      configuration = {
        ...configuration,
        ...loadedConfig,
      };
  } catch (e) {
    console.error(`[main] Error loading config: ${e.message}`);
  }
};

const main = async () => {
  loadConfiguration();

  for (let i = 0; i < DEFAULT_THREADS; i++) {
    setupChild(i);
  }

  for (let i = 0; i < count; i++) {
    const username = configuration.names[i] ?? `SYNTHETIC-KTZ-${i}`;

    const child = childProcesses[i % childProcesses.length];
    messageChild(child, { type: 'create', username });
  }
};

void main();

onShutdown(() => {
  saveYamlConfig(configuration, confFilePath);
});
