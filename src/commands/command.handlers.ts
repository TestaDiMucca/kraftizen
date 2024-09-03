import { Task, TaskPayload } from '../actions/performTask';
import { ChatKeys, sendChat as sendChatRaw } from '../character/chatLines';
import Kraftizen from '../Kraftizen';
import { getCardinalDirection } from '../utils/bot.utils';
import { Persona } from '../utils/types';
import { getRandomIntInclusive, sleep } from '../utils/utils';

export type CommandHandler = (context: {
  kraftizen: Kraftizen;
  username: string;
  message: string;
}) => Promise<void> | void;

type PreSeededSendChat = (
  messageOrKey: Parameters<typeof sendChatRaw>[1],
  chatOpts?: Parameters<typeof sendChatRaw>[2]
) => void;

type CommandHandlerExtended = {
  kraftizen: Kraftizen;
  username: string;
  message: string;
  behaviors: Kraftizen['behaviors'];
  tasks: Kraftizen['tasks'];
  addTask: Kraftizen['addTask'];
  sendChat: PreSeededSendChat;
};

/**
 * Factory to enforce types and bring out some commonly used
 * properties
 */
const handlerFactory = (
  cb: (args: CommandHandlerExtended) => void | Promise<void>
): CommandHandler => {
  return (params) => {
    const sendChat: PreSeededSendChat = (messageOrKey, opts) =>
      sendChatRaw(params.kraftizen.bot, messageOrKey, opts);
    const addTask = (task: TaskPayload, atEnd?: boolean) =>
      params.kraftizen.addTask(
        {
          ...task,
          verbose: true,
        },
        atEnd
      );
    return cb({
      ...params,
      behaviors: params.kraftizen.behaviors,
      tasks: params.kraftizen.tasks,
      addTask,
      sendChat,
    });
  };
};

const commandHandlers = {
  greet: handlerFactory(({ kraftizen, username }) => {
    setTimeout(
      () => kraftizen.greetUser(username),
      getRandomIntInclusive(100, 1000)
    );
  }),
  eat: handlerFactory(({ behaviors }) => behaviors.eat(true)),
  follow: handlerFactory(({ kraftizen, tasks, sendChat, username }) => {
    tasks.dropAllTasks();
    sendChat(`I will follow you, ${username}`);
    kraftizen.previousPersona = kraftizen.persona;
    kraftizen.persona = Persona.follower;
  }),
  guard: handlerFactory(({ kraftizen, sendChat }) => {
    sendChat(ChatKeys.guarding);
    kraftizen.setPersona(Persona.guard);
  }),
  loot: handlerFactory(({ sendChat, kraftizen }) => {
    sendChat('loot');
    kraftizen.setPersona(Persona.loot);
  }),
  home: handlerFactory(({ kraftizen }) => kraftizen.setHome()),
  arms: handlerFactory(({ behaviors, sendChat }) => {
    const arms = behaviors.equipMeleeWeapon();

    if (arms) {
      sendChat(`I have my ${arms.displayName}`);
    } else {
      sendChat('I have no weapons');
    }
  }),
  unsetPersona: handlerFactory(({ kraftizen, sendChat }) => {
    sendChat('relaxing');
    kraftizen.setPersona(Persona.none);
  }),
  collect: handlerFactory(({ addTask }) => addTask({ type: Task.collect })),
  deposit: handlerFactory(({ addTask }) =>
    addTask({ type: Task.findBlock, deposit: true })
  ),
  stay: handlerFactory(({ kraftizen }) =>
    kraftizen.setPersona(kraftizen.previousPersona)
  ),
  come: handlerFactory(({ tasks, addTask, username }) => {
    tasks.dropAllTasks();
    addTask({ type: Task.come, username, oneTime: true });
  }),
  campHere: handlerFactory(({ addTask, username }) =>
    addTask({ type: Task.come, username, oneTime: true, setHome: true })
  ),
  hunt: handlerFactory(({ addTask }) => addTask({ type: Task.hunt })),
  farm: handlerFactory(({ kraftizen, sendChat }) => {
    sendChat(ChatKeys.farming);
    kraftizen.setPersona(Persona.farmer);
  }),
  inventory: handlerFactory(({ behaviors }) => behaviors.listInventory()),
  objective: handlerFactory(({ tasks, sendChat }) => {
    const taskLabel =
      tasks.currentTask.type === Task.personaTask
        ? tasks.currentTask.description
        : tasks.currentTask.type;
    sendChat(`My current task is to ${taskLabel ?? 'idle'}`);
  }),
  coordinates: handlerFactory(({ kraftizen, username, sendChat }) => {
    const playerPos = kraftizen.bot.players[username]?.entity.position;
    const botPos = kraftizen.bot.entity.position;
    const baseMessage = `I am at x: ${botPos.x}, y: ${botPos.y}, x: ${botPos.z}`;
    sendChat(
      `${baseMessage}${
        playerPos ? ', to your ' + getCardinalDirection(playerPos, botPos) : ''
      }`
    );
  }),
  return: handlerFactory(({ addTask, sendChat }) => {
    sendChat(ChatKeys.returning);
    addTask({ type: Task.return });
  }),
  melee: handlerFactory(({ behaviors, sendChat }) => {
    behaviors.attackMode = 'melee';
    sendChat(ChatKeys.melee);
  }),
  sleep: handlerFactory(({ behaviors }) => behaviors.goSleep()),
  wake: handlerFactory(({ kraftizen }) => kraftizen.bot.wake()),
  withdraw: handlerFactory(({ addTask }) =>
    addTask({ type: Task.findBlock, withdraw: true, multiple: true })
  ),
  unknown: handlerFactory(({ sendChat, message }) =>
    sendChat('nonLoSo', {
      replacements: [['command', message]],
    })
  ),
  hold: handlerFactory(({ kraftizen, sendChat }) => {
    kraftizen.listening = true;
    sendChat(ChatKeys.wait);
  }),
  template: handlerFactory(({}) => {}),
};

export default commandHandlers;
