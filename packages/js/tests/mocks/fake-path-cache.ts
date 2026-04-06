import type { PathCacheInterface } from '../../src/contracts/path-cache-interface.js';

/**
 * Fake PathCacheInterface for use in tests.
 *
 * @internal
 */
export class FakePathCache implements PathCacheInterface {
    public readonly store: Map<string, string[]> = new Map();
    public getCallCount: number = 0;
    public setCallCount: number = 0;

    get(path: string): string[] | null {
        this.getCallCount++;
        return this.store.get(path) ?? null;
    }

    set(path: string, segments: string[]): void {
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
