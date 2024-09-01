import mineflayer from 'mineflayer';
import minecraftData from 'minecraft-data';
import pathfinder from 'mineflayer-pathfinder';
const autoEat = require('fix-esm').require('mineflayer-auto-eat').plugin;
import armorManager from 'mineflayer-armor-manager';
import hawkeye from 'minecrafthawkeye';

import { KraftizenBot, Persona, Position } from './utils/types';
import { Movements } from 'mineflayer-pathfinder';
import {
  botPosition,
  getCardinalDirection,
  getDefaultMovements,
} from './utils/bot.utils';
import { greet } from './actions/greet';
import {
  calculateDistance3D,
  getRandomIntInclusive,
  sleep,
} from './utils/utils';
import BehaviorsEngine from './actions/behaviors';
import { Task, TaskPayload } from './actions/performTask';
import { performTask } from './actions/performTask';
import { queuePersonaTasks } from './actions/queuePersonaTasks';
import { sendChat } from './character/chatLines';
import TeamMessenger, { TeamMessage } from './utils/TeamMessenger';
import { getRateLimiter } from './utils/RateLimiter';
import QueueManager from './utils/QueueManager';
import { botManagerEvents, EventTypes } from './utils/events';
import { INVENTORY_SLOTS_ALLOWED, MELEE_RANGE } from './utils/constants';
import ChatDecisionTree from './utils/ChatDecisionTree';

export type KraftizenOptions = mineflayer.BotOptions & {
  messenger: TeamMessenger;
  onErrored?: () => void;
};

export default class Kraftizen {
  /** Reference to the core bot brain */
  bot: KraftizenBot;
  /** Manual string for what bot is doing */
  state: string = 'existing';
  /** Be on the lookout for more commands */
  listening = false;
  /** Current job */
  persona = Persona.none;
  previousPersona = Persona.none;
  homePoint: Position;

  /** default to follow */
  lord: string | null = null;
  lastCommandFrom: string | null = null;

  tasks = new QueueManager();
  behaviors: BehaviorsEngine;
  rateLimiter = getRateLimiter();

  username: string;
  /** because bot.isSleeping does not seem reliable */
  sleeping = false;

  private defaultMove: Movements;
  private mcData: ReturnType<typeof minecraftData>;
  private messenger: TeamMessenger;
  private chatListener: ChatDecisionTree;

  constructor(
    options: KraftizenOptions,
    private taskRunner: typeof performTask
  ) {
    const { messenger, ...botOpts } = options;
    this.bot = mineflayer.createBot(botOpts);
    this.messenger = messenger;
    this.username = this.bot.username;
    this.chatListener = new ChatDecisionTree(this.bot);

    this.setup();
  }

  public getMovements = () => this.defaultMove;

  private messageOthers = (message: Omit<TeamMessage, 'sender'>) => {
    this.messenger.messageTeam({ ...message, sender: this });
  };

  public onTeamMessage = (message: TeamMessage) => {
    // ignore far peeps
    const distance = this.bot.entity.position.distanceTo(
      message.sender.bot.entity.position
    );

    if (distance > this.behaviors.range) return;

    const senderUsername = message.sender.bot.username;
    switch (message.message) {
      case 'help':
        console.log(senderUsername, 'asked for help from', this.bot.username);
        this.addTasks(
          [
            { type: Task.come, username: senderUsername },
            { type: Task.hunt, forceMelee: true },
          ],
          false
        );
        this.bot.chat(`Coming ${senderUsername}`);
        break;
      default:
    }
  };

  /**
   * Apply all the basic listeners
   */
  private setup = () => {
    this.bot.loadPlugins([
      pathfinder.pathfinder,
      autoEat,
      armorManager,
      hawkeye,
    ]);

    this.bot.on('spawn', () => {
      this.mcData = minecraftData(this.bot.version);
      this.defaultMove = getDefaultMovements(this.bot);
      this.bot.pathfinder.setMovements(this.defaultMove);

      this.behaviors = new BehaviorsEngine({
        bot: this.bot,
        defaultMove: this.defaultMove,
        defaultTargetPlayer: null,
        messenger: this.messenger,
      });

      if (!this.homePoint) this.homePoint = botPosition(this.bot);

      greet(this.bot);

      this.bot.armorManager.equipAll();

      this.loop();
    });

    this.bot.on('playerCollect', (collector) => {
      if (collector.uuid === this.bot.entity.uuid) {
        const slotsEmpty = this.bot.inventory.emptySlotCount();
        // todo: const
        if (slotsEmpty < INVENTORY_SLOTS_ALLOWED)
          this.addTask({ type: Task.findBlock, deposit: true });
      }
    });

    this.bot.on('chat', this.handleChat);

    this.bot.on('death', () => {
      /** Return to death point */
      this.tasks.dropAllTasks();
      this.tasks.addTasks(
        [
          {
            type: Task.visit,
            position: this.bot.entity.position,
          },
        ],
        true
      );
      this.tasks.blockTasksForMs(5000);
    });
    this.bot.on('respawn', () => {
      sendChat(this.bot, 'respawn', { delay: 1000 });
      this.addTasks([
        { type: Task.return },
        { type: Task.collect },
        { type: Task.findBlock, withdraw: true, multiple: true },
      ]);
    });

    this.bot.on('health', () => {
      if (this.bot.food >= 18) this.bot.autoEat?.disable();
      else this.bot.autoEat?.enable();
    });

    this.bot.on('wake', () => {
      this.tasks.dropAllTasks();
      this.addTask({ type: Task.return });
      this.sleeping = false;
    });

    this.bot.on('error', (error) => {
      console.error('bot error', error);
      botManagerEvents.emit(EventTypes.botError, {
        botName: this.bot.username,
        error,
      });
    });

    this.bot.on('sleep', () => {
      this.sleeping = true;
    });

    this.bot.on('target_aiming_at_you', () => {});

    this.bot._client.on('hurt_animation', async (packet, _meta) => {
      const entity = this.bot.entities[packet.entityId];

      /* I got hurt */
      if (entity.uuid === this.bot.entity.uuid) {
        const nearby = this.behaviors.getNearestHostileMob(MELEE_RANGE);

        if (nearby && !this.bot.usingHeldItem) {
          this.behaviors.attackWildly(nearby);
          return;
        }

        /** Already fighting */
        if (this.tasks.firstTaskIs(Task.hunt)) return;

        this.addTask({ type: Task.hunt });
        if (this.bot.health < 8 && this.rateLimiter.tryCall('demandHelp')) {
          this.addTasks([{ type: Task.return }, { type: Task.eat }]);
          this.bot.chat('help!');
          this.messageOthers({ message: 'help' });
        }
      }
    });
  };

  public distanceFromHome = (position?: Position) => {
    return calculateDistance3D(
      position ?? this.bot.player.entity.position,
      this.homePoint
    );
  };

  public setHome = (askToFindBed = false) => {
    sendChat(this.bot, 'setHome');
    this.homePoint = botPosition(this.bot);

    if (askToFindBed)
      this.chatListener.promptResponse({
        prompt: 'findBed',
        chattingWith: this.lastCommandFrom,
        options: {
          no: null,
          yes: () => {
            sendChat(this.bot, 'ok');
            this.addTask({ type: Task.sleep });
          },
        },
      });
  };

  public shutDown = () => {
    this.bot.quit();
  };

  private setPersona = (persona: Persona) => {
    if (this.persona === Persona.follower) {
      /** No longer following = set new home */
      this.setHome(true);
    }

    this.persona = persona;
  };

  private handleChat = (username: string, message: string) => {
    if (username === this.bot.player.username) return;

    if (this.chatListener.isListening()) {
      console.log('forward to listener');
      this.chatListener.handleChat(username, message);
      return;
    }

    const [command, target] = message
      .split(',')
      .map((s) => s.trim().toLowerCase());

    if (
      [this.bot.player.username.toLowerCase(), 'all', 'kraftizens'].every(
        (s) => s !== target
      )
    )
      return;

    this.lastCommandFrom = username;

    switch (command) {
      case 'obey':
        break;
      case 'hello':
        setTimeout(
          () => this.greetUser(username),
          getRandomIntInclusive(100, 1000)
        );
        break;
      case 'eat':
        this.behaviors.eat(true);
        break;
      case 'follow':
        this.tasks.dropAllTasks();
        sendChat(this.bot, `I will follow you, ${username}.`);
        this.previousPersona = this.persona;
        this.persona = Persona.follower;
        break;
      case 'guard':
        sendChat(this.bot, 'guarding');
        this.setPersona(Persona.guard);
        break;
      case 'loot':
        sendChat(this.bot, 'loot');
        this.setPersona(Persona.loot);
        break;
      case 'home':
        this.setHome();
        break;
      case 'arms':
        const arms = this.behaviors.equipMeleeWeapon();

        if (arms) {
          sendChat(this.bot, `I have my ${arms.displayName}`);
        } else {
          sendChat(this.bot, 'I have no weapons');
        }
        break;
      case 'relax':
      case 'chill':
        sendChat(this.bot, 'relaxing');
        this.setPersona(Persona.none);
        break;
      case 'collect':
        this.addTask({ type: Task.collect, verbose: true });
        break;
      case 'deposit':
      case 'unload':
        this.addTask({
          type: Task.findBlock,
          deposit: true,
          verbose: true,
        });
        break;
      case 'stay':
        this.setPersona(this.previousPersona);
        break;
      case 'come':
      case 'here':
        this.tasks.dropAllTasks();
        this.tasks.addTask({ type: Task.come, username, oneTime: true });
        break;
      case 'camp here':
        this.tasks.addTask({
          type: Task.come,
          username,
          oneTime: true,
          setHome: true,
        });
        break;
      case 'hunt':
        this.tasks.addTask({ type: Task.hunt, verbose: true });
        break;
      case 'farm':
        sendChat(this.bot, 'farming');
        this.setPersona(Persona.farmer);
        break;
      case 'nearby':
        console.log(this.bot.entities);
        break;
      case 'inventory':
        this.behaviors.listInventory();
        break;
      case 'objective':
      case 'directive':
      case 'current task':
        const taskLabel =
          this.tasks.currentTask.type === Task.personaTask
            ? this.tasks.currentTask.description
            : this.tasks.currentTask.type;
        sendChat(this.bot, `My current task is to ${taskLabel ?? 'idle'}`);
        break;
      case 'location':
      case 'where are you':
      case 'coordinates':
        const playerPos = this.bot.players[username]?.entity.position;
        const botPos = this.bot.entity.position;
        const baseMessage = `I am at x: ${botPos.x}, y: ${botPos.y}, x: ${botPos.z}`;
        sendChat(
          this.bot,
          `${baseMessage}${
            playerPos
              ? ', to your ' + getCardinalDirection(playerPos, botPos)
              : ''
          }`
        );
        break;
      case 'return':
        sendChat(this.bot, 'returning');
        this.tasks.addTask({ type: Task.return });
        break;
      case 'prefer melee':
        // TODO: improve commanding
        this.behaviors.attackMode = 'melee';
        sendChat(this.bot, 'melee');
        break;
      case 'sleep':
        this.behaviors.goSleep();
        break;
      case 'wake':
        this.bot.wake();
        break;
      case 'block at':
        const block = this.bot.blockAt(this.bot.entity.position, true);
        console.log(block, this.bot.canSeeBlock(block));
        break;
      case 'withdraw':
      case 'stock up':
        this.tasks.addTask({
          type: Task.findBlock,
          verbose: true,
          withdraw: true,
          multiple: true,
        });
        break;
      default:
        sendChat(this.bot, 'nonLoSo', {
          replacements: [['command', command]],
        });
    }
  };

  private greetUser = async (username: string) => {
    const player = this.bot.players[username].entity;

    if (!player) return;

    await sleep(300);
    this.bot.lookAt(player.position);
    this.bot.swingArm('right');
    this.bot.chat(`Hello, ${username}`);
  };

  private performTask = (task: TaskPayload) => {
    return this.taskRunner(task, this);
  };

  /**
   * The async tasks are like a to-do list item, things the kraftizen
   * wants to accomplish now, like commands or job functions, may be run inline
   */
  public addTask = (task: TaskPayload, atEnd = false) => {
    this.tasks.addTask(task, atEnd);
  };

  public addTasks = (tasks: TaskPayload[], atEnd = false) => {
    if (atEnd) {
      tasks.forEach((task) => this.addTask(task, atEnd));
    } else {
      tasks.reverse().forEach((task) => this.addTask(task));
    }
  };

  /**
   * Main behaviors loop
   */
  private loop = async () => {
    let delay = 2000;
    try {
      /** Blocking states */
      if (this.chatListener.isListening()) {
        delay = 4000;
      } else {
        const nextTask = this.tasks.nextTask();

        if (nextTask && !this.tasks.currentTask) {
          this.tasks.currentTask = nextTask;
          await this.performTask(nextTask);
          delay = 500;
        }

        if (this.tasks.isEmpty()) {
          await queuePersonaTasks(this);
        }
      }
    } catch (e) {
      console.error('Error while looping', e);
    }

    setTimeout(this.loop, delay);
  };
}
