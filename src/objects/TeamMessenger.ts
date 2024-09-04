import Kraftizen from '../Kraftizen';
import EventEmitter from 'events';

type ItemClaim = 'bed';

export default class TeamMessenger {
  teamMembers: Record<string, Kraftizen> = {};
  emitter = new EventEmitter();
  claims = new Map<string, Set<string>>();

  constructor(teamMembers: Record<string, Kraftizen>) {
    this.teamMembers = teamMembers;
  }

  public messageTeam = (message: TeamMessage) => {
    process.send && process.send(message);
  };

  public onTeamMessage = (message: TeamMessage) => {
    setImmediate(() => {
      Object.values(this.teamMembers)
        .filter((kraftizen) => kraftizen.bot.username !== message.sender)
        .forEach((kraftizen) => {
          kraftizen.onTeamMessage(message);
        });
    });
  };

  /**
   * Make a claim to an item/whatever so other bots will disregard it
   */
  public setClaimedItem = (item: ItemClaim, pos: string | null) => {
    if (!this.claims.has(item)) this.claims.set(item, new Set<string>());

    const itemMap = this.claims.get(item);
    if (pos === null) {
      itemMap.delete(pos);
    } else {
      itemMap.add(pos);
    }
  };

  public checkClaimedItem = (item: ItemClaim, pos: string) => {
    if (!this.claims.has(item)) return false;

    return !!this.claims.get(item).has(item);
  };
}

export type TeamMessage = {
  sender: string;
  message: string;
};
