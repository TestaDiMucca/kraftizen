import mineflayer from 'mineflayer';
import minecraftData from 'minecraft-data';
import pathfinder from 'mineflayer-pathfinder';
const autoEat = require('fix-esm').require('mineflayer-auto-eat').plugin;
import armorManager from 'mineflayer-armor-manager';

import { KraftizenBot, Persona, Position } from './types';
import { Movements } from 'mineflayer-pathfinder';
import { botPosition } from './bot.utils';
import { greet } from './actions/greet';
import { calculateDistance3D, getRandomIntInclusive, sleep } from './utils';
import BehaviorsEngine from './actions/behaviors';
import { Task, TaskPayload } from './actions/performTask';
import { performTask } from './actions/performTask';
import { queuePersonaTasks } from './actions/queuePersonaTasks';
import { sendChat } from '../character/chatLines';

export default class Kraftizen {
  /** Reference to the core bot brain */
  bot: KraftizenBot;
  /** Manual string for what bot is doing */
  state: string = 'existing';
  /** Be on the lookout for more commands */
  listening = false;
  /** Disable all attacking behaviors */
  passive = false;
  /** Current job */
  persona = Persona.none;
  previousPersona = Persona.none;
  homePoint: Position;

  /** default to follow */
  lord: string | null = null;
  lastCommandFrom: string | null = null;

  taskQueue: TaskPayload[] = [];

  behaviors: BehaviorsEngine;

  private defaultMove: Movements;
  private mcData: ReturnType<typeof minecraftData>;

  currentTask: TaskPayload;

  constructor(
    options: mineflayer.BotOptions,
    private taskRunner: typeof performTask
  ) {
    this.bot = mineflayer.createBot(options);

    this.setup();
  }

  /**
   * Apply all the basic listeners
   */
  private setup = () => {
    this.bot.loadPlugins([pathfinder.pathfinder, autoEat, armorManager]);
    this.bot.on('spawn', () => {
      this.mcData = minecraftData(this.bot.version);
      this.defaultMove = new Movements(this.bot);
      this.defaultMove.canOpenDoors = true;

      this.behaviors = new BehaviorsEngine({
        bot: this.bot,
        defaultMove: this.defaultMove,
        defaultTargetPlayer: null,
      });

      if (!this.homePoint) this.homePoint = botPosition(this.bot);

      greet(this.bot);

      this.bot.armorManager.equipAll();

      this.loop();
    });

    this.bot.on('chat', this.handleChat);

    this.bot.on('respawn', () => {
      this.addTask({ type: Task.findChest, withdraw: true, multiple: true });
    });

    this.bot.on('health', () => {
      if (this.bot.food >= 18) this.bot.autoEat?.disable();
      else this.bot.autoEat?.enable();
    });

    this.bot._client.on('hurt_animation', async (packet) => {
      const entity = this.bot.entities[packet.entityId];
      if (
        entity.uuid === this.bot.entity.uuid &&
        !this.taskQueue.find((i) => i.type === Task.hunt)
      )
        this.addTask({ type: Task.hunt });
    });
  };

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
        this.bot.chat(`I will follow you, ${username}.`);
        this.previousPersona = this.persona;
        this.persona = Persona.follower;
        break;
      case 'guard':
        sendChat(this.bot, 'guarding');
        this.setPersona(Persona.guard);
        break;
      case 'home':
        this.setHome();
        break;
      case 'relax':
        sendChat(this.bot, 'relaxing');
        this.setPersona(Persona.none);
        break;
      case 'collect':
        this.addTask({ type: Task.collect, verbose: true });
        break;
      case 'stay':
        this.setPersona(this.previousPersona);
        break;
      case 'come':
      case 'here':
        this.taskQueue.unshift({ type: Task.come, username, oneTime: true });
        break;
      case 'camp here':
        this.taskQueue.unshift({ type: Task.come, username, oneTime: true });
        this.taskQueue.push({ type: Task.setHome });
        break;
      case 'hunt':
        this.taskQueue.unshift({ type: Task.hunt, verbose: true });
        break;
      case 'current task':
        this.bot.chat(`My current task is ${this.currentTask ?? 'nothing'}`);
        break;
      case 'return':
        sendChat(this.bot, 'returning');
        this.taskQueue.unshift({ type: Task.return });
        break;
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

  public finishCurrentTask = () => {
    this.currentTask = null;
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
        delay = 900;
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
