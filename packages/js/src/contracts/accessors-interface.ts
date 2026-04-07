import type { ReadableAccessorsInterface } from './readable-accessors-interface.js';
import type { WritableAccessorsInterface } from './writable-accessors-interface.js';
import type { FactoryAccessorsInterface } from './factory-accessors-interface.js';

/**
 * Unified contract combining read, write, and factory capabilities.
 *
 * Marker interface that aggregates all accessor responsibilities into
 * a single type, used as the base contract for AbstractAccessor.
 */
export interface AccessorsInterface
    extends ReadableAccessorsInterface, WritableAccessorsInterface, FactoryAccessorsInterface {}
