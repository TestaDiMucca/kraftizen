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
      auth?: AuthTypes;
      id: number;
    }
  | {
      type: 'teamMessage';
      message: TeamMessage;
    };

export type Configuration = {
  names?: string[];
  host?: string;
  port?: number;
  auth?: AuthTypes;
  threads?: number;
};
