import mineflayer from 'mineflayer';
import minecraftData from 'minecraft-data';
import pathfinder from 'mineflayer-pathfinder';

import { KraftizenBot, Persona, Position } from './types';
import { Movements } from 'mineflayer-pathfinder';
import { botPosition } from './bot.utils';
import { greet } from './actions/greet';
import { sleep } from './utils';
import BehaviorsEngine from './actions/behaviors';
import { Task, TaskPayload } from './actions/tasks';
import { performTask } from './actions/tasks';

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

  private setup = () => {
    this.bot.loadPlugins([pathfinder.pathfinder]);
    this.bot.on('spawn', () => {
      this.mcData = minecraftData(this.bot.version);
      this.defaultMove = new Movements(this.bot);

      this.behaviors = new BehaviorsEngine({
        bot: this.bot,
        defaultMove: this.defaultMove,
        defaultTargetPlayer: null,
      });

      if (!this.homePoint) this.homePoint = botPosition(this.bot);

      greet(this.bot);

      this.loop();
    });

    this.bot.on('chat', this.handleChat);

    this.bot._client.on('hurt_animation', async (packet) => {
      console.log('hurt 2');
      const entity = this.bot.entities[packet.entityId];
      if (
        entity.uuid === this.bot.entity.uuid &&
        !this.taskQueue.find((i) => i.type === Task.hunt)
      )
        this.addTask({ type: Task.hunt });
    });
  };

  private handleChat = (username: string, message: string) => {
    this.lastCommandFrom = username;
    switch (message) {
      case 'obey':
        break;
      case 'hello':
        this.greetUser(username);
        break;
      case 'follow':
        // this.behaviors.follow(username);
        this.bot.chat(`I will follow you, ${username}.`);
        this.previousPersona = this.persona;
        this.persona = Persona.follower;
        break;
      case 'collect':
        this.addTask({ type: Task.collect });
        break;
      case 'stay':
        // this.behaviors.stopFollow();
        this.bot.chat('I will stay here for now.');
        this.homePoint = botPosition(this.bot);
        this.persona = this.previousPersona;
        break;
      case 'come':
        this.taskQueue.unshift({ type: Task.come, username, oneTime: true });
        break;
      case 'hunt':
        this.taskQueue.unshift({ type: Task.hunt });
        break;
      case 'return':
        this.taskQueue.unshift({ type: Task.return });
        break;
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
    } catch (e) {
      console.error('Error while looping', e);
    }

    setTimeout(this.loop, delay);
  };
}
