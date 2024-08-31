import mineflayer from 'mineflayer';
import minecraftData from 'minecraft-data';
import pathfinder from 'mineflayer-pathfinder';
const autoEat = require('fix-esm').require('mineflayer-auto-eat').plugin;
import armorManager from 'mineflayer-armor-manager';
import hawkeye from 'minecrafthawkeye';

import { KraftizenBot, Persona, Position } from './types';
import { Movements } from 'mineflayer-pathfinder';
import { botPosition, getDefaultMovements } from './bot.utils';
import { greet } from './actions/greet';
import { calculateDistance3D, getRandomIntInclusive, sleep } from './utils';
import BehaviorsEngine from './actions/behaviors';
import { Task, TaskPayload } from './actions/performTask';
import { performTask } from './actions/performTask';
import { queuePersonaTasks } from './actions/queuePersonaTasks';
import { sendChat } from '../character/chatLines';
import TeamMessenger, { TeamMessage } from './TeamMessenger';
import rateLimiter from './RateLimiter';

rateLimiter.setLimitForKey('demandHelp', {
  max: 1,
  windowMs: 1000 * 30,
});

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

  taskQueue: TaskPayload[] = [];

  behaviors: BehaviorsEngine;

  username: string;

  private defaultMove: Movements;
  private mcData: ReturnType<typeof minecraftData>;
  private messenger: TeamMessenger;

  currentTask: TaskPayload;

  constructor(
    options: mineflayer.BotOptions & { messenger: TeamMessenger },
    private taskRunner: typeof performTask
  ) {
    const { messenger, ...botOpts } = options;
    this.bot = mineflayer.createBot(botOpts);
    this.messenger = messenger;
    this.username = this.bot.username;

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
        if (slotsEmpty < 4)
          this.addTask({ type: Task.findChest, deposit: true });
      }
    });

    this.bot.on('chat', this.handleChat);

    this.bot.on('respawn', () => {
      this.addTasks([
        { type: Task.return },
        { type: Task.findChest, withdraw: true, multiple: true },
      ]);
    });

    this.bot.on('health', () => {
      if (this.bot.food >= 18) this.bot.autoEat?.disable();
      else this.bot.autoEat?.enable();
    });

    this.bot.on('wake', () => {
      this.dropAllTasks();
      this.addTask({ type: Task.return });
    });

    this.bot._client.on('hurt_animation', async (packet, meta) => {
      const entity = this.bot.entities[packet.entityId];

      /** Already fighting */
      if (this.hasTask(Task.hunt)) return;

      if (entity.uuid === this.bot.entity.uuid) {
        this.addTask({ type: Task.hunt });
        if (
          this.bot.health < 8 &&
          rateLimiter.tryCall('demandHelp', this.bot.username)
        ) {
          this.addTask({ type: Task.return });
          this.bot.chat('help!');
          this.messageOthers({ message: 'help' });
        }
      }
    });
  };

  public removeTasksOfType = (taskType: Task) => {
    this.taskQueue = this.taskQueue.filter((task) => task.type === taskType);
  };

  public hasTask = (task: Task) => this.taskQueue.find((i) => i.type === task);

  public distanceFromHome = (position?: Position) => {
    return calculateDistance3D(
      position ?? this.bot.player.entity.position,
      this.homePoint
    );
  };

  public setHome = () => {
    this.bot.chat('I will stay around here');
    this.homePoint = botPosition(this.bot);
  };

  private setPersona = (persona: Persona) => {
    if (this.persona === Persona.follower) {
      this.setHome();
    }

    this.persona = persona;
  };

  private handleChat = (username: string, message: string) => {
    if (username === this.bot.player.username) return;

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
      case 'follow':
        this.dropAllTasks();
        this.bot.chat(`I will follow you, ${username}.`);
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
          this.bot.chat(`I have my ${arms.displayName}`);
        } else {
          this.bot.chat('I have no weapons');
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
          type: Task.findChest,
          deposit: true,
          verbose: true,
        });
        break;
      case 'stay':
        this.setPersona(this.previousPersona);
        break;
      case 'come':
      case 'here':
        this.dropAllTasks();
        this.taskQueue.unshift({ type: Task.come, username, oneTime: true });
        break;
      case 'camp here':
        this.taskQueue.unshift({
          type: Task.come,
          username,
          oneTime: true,
          setHome: true,
        });
        break;
      case 'hunt':
        this.taskQueue.unshift({ type: Task.hunt, verbose: true });
        break;
      case 'nearby':
        console.log(this.bot.entities);
        break;
      case 'inventory':
        this.behaviors.listInventory();
        break;
      case 'current task':
        this.bot.chat(`My current task is to ${this.currentTask ?? 'idle'}`);
        break;
      case 'return':
        sendChat(this.bot, 'returning');
        this.taskQueue.unshift({ type: Task.return });
        break;
      case 'prefer melee':
        // TODO: improve commanding
        this.behaviors.attackMode = 'melee';
        this.bot.chat('I will attack melee from now on');
        break;
      case 'sleep':
        this.behaviors.goSleep();
        break;
      case 'block at':
        const block = this.bot.blockAt(this.bot.entity.position, true);
        console.log(block, this.bot.canSeeBlock(block));
        break;
      case 'withdraw':
      case 'stock up':
        this.taskQueue.unshift({
          type: Task.findChest,
          verbose: true,
          withdraw: true,
          multiple: true,
        });
        break;
      default:
        this.bot.chat(
          `I don't understand "${command}." Read the manual, peasant`
        );
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

  public addTask = (task: TaskPayload, atEnd = false) => {
    if (atEnd) this.taskQueue.push(task);
    else this.taskQueue.unshift(task);
  };

  public addTasks = (tasks: TaskPayload[], atEnd = false) => {
    if (atEnd) {
      tasks.forEach((task) => this.addTask(task, atEnd));
    } else {
      tasks.reverse().forEach((task) => this.addTask(task));
    }
  };

  public finishCurrentTask = () => {
    this.currentTask = null;
  };

  private dropAllTasks = () => {
    this.finishCurrentTask();
    this.taskQueue = [];
  };

  /**
   * Main behaviors loop
   */
  private loop = async () => {
    let delay = 2000;
    try {
      const nextTask = this.taskQueue.shift();

      if (nextTask && !this.currentTask) {
        this.currentTask = nextTask;
        await this.performTask(nextTask);
        delay = 500;
      }

      if (this.taskQueue.length === 0) {
        await queuePersonaTasks(this);
      }
    } catch (e) {
      console.error('Error while looping', e);
    }

    setTimeout(this.loop, delay);
  };
}
