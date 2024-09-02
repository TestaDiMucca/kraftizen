import { ChildProcess, fork } from 'child_process';
import path from 'path';

import { DEFAULT_THREADS, DEFAULT_NAMES } from './utils/constants';
import { ProcessMessage } from './utils/utils.types';

const count = Math.min(parseInt(process.argv[2] ?? '4'), 10);

console.log('Start with bot count:', count);

const childProcesses: ChildProcess[] = [];

const messageChild = (child: ChildProcess, message: ProcessMessage) => {
  child.send(message);
};

const setupChild = () => {
  const child = fork(path.join(__dirname, './kraftizenThread.ts'));

  child.on('message', (message: ProcessMessage) => {
    switch (message.type) {
      case 'teamMessage':
        childProcesses.forEach((child) => messageChild(child, message));
        break;
      default:
    }
  });

  child.on('exit', (code) => {
    console.log(`Child process exited with code ${code}`);
  });

  childProcesses.push(child);
};

const main = () => {
  for (let i = 0; i < DEFAULT_THREADS; i++) {
    setupChild();
  }

  for (let i = 0; i < count; i++) {
    const username = DEFAULT_NAMES[i] ?? `SYNTHETIC-KTZ-${i}`;

    const child = childProcesses[i % childProcesses.length];
    messageChild(child, { type: 'create', username });
  }
};

main();
