import { TeamMessage } from './TeamMessenger';
import { Persona } from './types';

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
    }
  | {
      type: 'error';
      error: string;
    };

/** Persisted global state */
export type Configuration = {
  names?: string[];
  host?: string;
  port?: number;
  auth?: AuthTypes;
  threads?: number;
};

/** Persisted per-bot state */
export type KraftizenConfiguration = {
  homePoint: [number, number, number];
  persona: Persona;
};
