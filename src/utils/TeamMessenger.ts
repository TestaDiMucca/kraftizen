import Kraftizen from '../Kraftizen';
import EventEmitter from 'events';

type ItemClaim = 'bed';

export default class TeamMessenger {
  teamMembers: Kraftizen[] = [];
  emitter = new EventEmitter();
  claims = new Map<string, Set<string>>();

  constructor(teamMembers: Kraftizen[]) {
    this.teamMembers = teamMembers;
  }

  public messageTeam = (message: TeamMessage) => {
    // Todo: this is a function call because we can, but maybe leverage actual events
    setImmediate(() => {
      this.teamMembers
        .filter(
          (kraftizen) => kraftizen.bot.username !== message.sender.bot.username
        )
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
  sender: Kraftizen;
  message: string;
};
