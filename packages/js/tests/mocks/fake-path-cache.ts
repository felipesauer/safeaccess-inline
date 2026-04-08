import type { PathCacheInterface } from '../../src/contracts/path-cache-interface.js';
import type { Segment } from '../../src/path-query/segment-type.js';

/**
 * Fake PathCacheInterface for use in tests.
 *
 * @internal
 */
export class FakePathCache implements PathCacheInterface {
    public readonly store: Map<string, Segment[]> = new Map();
    public getCallCount: number = 0;
    public setCallCount: number = 0;

    get(path: string): Segment[] | null {
        this.getCallCount++;
        return this.store.get(path) ?? null;
    }

    set(path: string, segments: Segment[]): void {
        this.setCallCount++;
        this.store.set(path, segments);
    }

    has(path: string): boolean {
        return this.store.has(path);
    }

    clear(): this {
        this.store.clear();
        return this;
    }
}
