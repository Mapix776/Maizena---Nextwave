import { EventEmitter } from 'node:events';

class TypedEventBus extends EventEmitter {}

export const eventBus = new TypedEventBus();
eventBus.setMaxListeners(50); // varios runs concurrentes
