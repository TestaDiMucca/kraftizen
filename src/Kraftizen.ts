import mineflayer from 'mineflayer';
import minecraftData from 'minecraft-data';
import pathfinder from 'mineflayer-pathfinder';
const autoEat = require('fix-esm').require('mineflayer-auto-eat').plugin;
import armorManager from 'mineflayer-armor-manager';
import hawkeye from 'minecrafthawkeye';

import { KraftizenBot, Persona, Position } from './utils/types';
import { Movements } from 'mineflayer-pathfinder';
import { botPosition, getDefaultMovements } from './utils/bot.utils';
import { greet } from './actions/greet';
import { calculateDistance3D, sleep } from './utils/utils';
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
import { KraftizenConfiguration } from './utils/utils.types';
import processChatCommand from './commands/commands';

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
    this.username = botOpts.username;
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
        console.debug(senderUsername, 'asked for help from', this.bot.username);
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
      this.rateLimiter.resetKey('demandHelp');
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

  public setPersona = (persona: Persona) => {
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

    processChatCommand({ kraftizen: this, username, message: command });
  };

  public greetUser = async (username: string) => {
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
   * Main behaviors event loop
   */
  private loop = async () => {
    let delay = 2000;
    try {
      /** Blocking states */
      if (this.chatListener.isListening() || this.sleeping) {
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

  public statePersister = {
    get: (): KraftizenConfiguration => ({
      persona: this.persona,
      homePoint: [this.homePoint.x, this.homePoint.y, this.homePoint.z],
    }),
    set: (config: KraftizenConfiguration) => {
      if (config.persona) this.persona = config.persona;
      if (config.homePoint)
        this.homePoint = {
          x: config.homePoint[0],
          y: config.homePoint[1],
          z: config.homePoint[2],
        };
    },
  };
}
