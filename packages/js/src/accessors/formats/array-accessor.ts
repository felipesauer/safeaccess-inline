import { AbstractAccessor } from '../abstract-accessor.js';
import { InvalidFormatException } from '../../exceptions/invalid-format-exception.js';

/**
 * Accessor for plain objects and arrays.
 *
 * Accepts a plain object or array directly. No string parsing is involved.
 *
 * @example
 * const accessor = new ArrayAccessor(parser).from({ key: 'value' });
 * accessor.get('key'); // 'value'
 */
export class ArrayAccessor extends AbstractAccessor {
    /**
     * Hydrate from a plain object or array.
     *
     * @param data - Object or array input.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When input is neither an object nor an array.
     * @throws {SecurityException} When data contains forbidden keys.
     *
     * @example
     * accessor.from({ name: 'Alice' });
     */
    from(data: unknown): this {
        if (typeof data !== 'object' || data === null) {
            /* Stryker disable StringLiteral -- error message content is cosmetic */
            throw new InvalidFormatException(
                `ArrayAccessor expects an object or array, got ${typeof data}`,
            );
            /* Stryker restore StringLiteral */
        }

        const resolved: Record<string, unknown> = Array.isArray(data)
            ? Object.fromEntries(data.map((v, i) => [String(i), v]))
            : (data as Record<string, unknown>);

        return this.ingest(resolved);
    }

    /** {@inheritDoc} */
    protected parse(raw: unknown): Record<string, unknown> {
        return raw as Record<string, unknown>;
    }
}
