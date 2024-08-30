import Kraftizen from './Kraftizen';
import EventEmitter from 'events';

export default class TeamMessenger {
  teamMembers: Kraftizen[] = [];
  emitter = new EventEmitter();

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
}

export type TeamMessage = {
  sender: Kraftizen;
  message: string;
};
