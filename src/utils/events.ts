import { EventEmitter } from 'events';

export enum EventTypes {
  botError = 'botError',
}

interface EventMap {
  [EventTypes.botError]: { botName: string; error: Error };
}

class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof EventMap>(eventName: K, data: EventMap[K]) {
    return super.emit(eventName, data);
  }

  on<K extends keyof EventMap>(
    eventName: K,
    listener: (data: EventMap[K]) => void
  ): this {
    return super.on(eventName, listener);
  }

  once<K extends keyof EventMap>(
    eventName: K,
    listener: (data: EventMap[K]) => void
  ): this {
    return super.once(eventName, listener);
  }
}

export const botManagerEvents = new TypedEventEmitter();
