import mineflayer from 'mineflayer';
import minecraftData from 'minecraft-data';
import pathfinder from 'mineflayer-pathfinder';

import { KraftizenBot, Persona, PlayerCommands, Position } from './types';
import { Movements } from 'mineflayer-pathfinder';
import { botPosition } from './bot.utils';
import { greet } from './actions/greet';
import { sleep } from './utils';
import BehaviorsEngine from './actions/behaviors';

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

  commandQueue: PlayerCommands[] = [];

  behaviors: BehaviorsEngine;

  defaultMove: Movements;
  mcData: ReturnType<typeof minecraftData>;

  constructor(options: mineflayer.BotOptions) {
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

    this.bot.on('entityHurt', async (entity) => {
      if (entity.uuid === this.bot.entity.uuid) {
        // got hit
        await this.behaviors.cancelAll();
        this.behaviors.attackNearest(entity);
      }
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
      case 'stay':
        // this.behaviors.stopFollow();
        this.bot.chat('I will stay here for now.');
        this.homePoint = botPosition(this.bot);
        this.persona = this.previousPersona;
        break;
      case 'come':
        this.behaviors.toPlayer(username);
        break;
      case 'hunt':
        this.behaviors.attackNearest(undefined, 30, true);
        break;
      case 'return':
        this.behaviors.cancelAll();
        this.bot.chat('I will return to where I came from');
        this.behaviors.toCoordinate(this.homePoint);
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

  /**
   * Main behaviors loop
   */
  private loop = async () => {
    try {
      if (!this.bot.pathfinder.goal) {
        switch (this.persona) {
          case Persona.follower:
            await this.behaviors.moveToPlayer(this.lastCommandFrom);
            break;
          default:
            await this.behaviors.attackNearest(undefined, 5);
        }
      }
    } catch (e) {
      console.error('Error while looping', e);
    }

    setTimeout(this.loop, 1000);
  };
}
