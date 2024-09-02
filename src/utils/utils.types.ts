import { TeamMessage } from './TeamMessenger';

export type AuthTypes = 'offline' | 'microsoft' | 'mojang';

export type ProcessMessage =
  | {
      type: 'create';
      username: string;
    }
  | {
      type: 'config';
      host: string;
      port: number;
      auth: AuthTypes;
    }
  | {
      type: 'teamMessage';
      message: TeamMessage;
    };
