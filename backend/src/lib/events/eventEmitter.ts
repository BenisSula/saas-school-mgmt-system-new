/**
 * Event Emitter System
 *
 * Provides a type-safe event system for async workflows and decoupled operations.
 * Used by services to emit events that can be handled asynchronously.
 */

import { EventEmitter as NodeEventEmitter } from 'events';

/**
 * Event payload type
 */
export type EventPayload = Record<string, unknown>;

/**
 * Event listener function type
 */
export type EventListener<T = EventPayload> = (payload: T) => void | Promise<void>;

/**
 * Type-safe Event Emitter
 *
 * Extends Node.js EventEmitter with TypeScript support for event types.
 */
class TypedEventEmitter extends NodeEventEmitter {
  /**
   * Emit an event with typed payload
   */
  emitEvent<T extends EventPayload>(event: string, payload: T): boolean {
    return this.emit(event, payload);
  }

  /**
   * Register an event listener with typed payload
   */
  onEvent<T extends EventPayload>(event: string, listener: EventListener<T>): this {
    return this.on(event, listener as EventListener);
  }

  /**
   * Register a one-time event listener
   */
  onceEvent<T extends EventPayload>(event: string, listener: EventListener<T>): this {
    return this.once(event, listener as EventListener);
  }

  /**
   * Remove an event listener
   */
  offEvent<T extends EventPayload>(event: string, listener: EventListener<T>): this {
    return this.off(event, listener as EventListener);
  }
}

/**
 * Global event emitter instance
 *
 * Services use this to emit events for async workflows.
 */
export const eventEmitter = new TypedEventEmitter();

/**
 * Helper to emit events with error handling
 */
export async function emitEventSafely<T extends EventPayload>(
  event: string,
  payload: T
): Promise<void> {
  try {
    eventEmitter.emitEvent(event, payload);
  } catch (error) {
    console.error(`[EventEmitter] Error emitting event ${event}:`, error);
  }
}

/**
 * Helper to register event handlers with error handling
 */
export function onEvent<T extends EventPayload>(event: string, handler: EventListener<T>): void {
  eventEmitter.onEvent(event, async (payload: T) => {
    try {
      await handler(payload);
    } catch (error) {
      console.error(`[EventEmitter] Error handling event ${event}:`, error);
    }
  });
}
