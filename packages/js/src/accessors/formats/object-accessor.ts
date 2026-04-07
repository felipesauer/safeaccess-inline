import { AbstractAccessor } from '../abstract-accessor.js';
import { InvalidFormatException } from '../../exceptions/invalid-format-exception.js';
import { SecurityException } from '../../exceptions/security-exception.js';

/**
 * Accessor for JavaScript objects, converting them to plain records recursively.
 *
 * Handles nested objects and arrays of objects without JSON roundtrip.
 * Respects the configured max depth to prevent DoS from deeply nested structures.
 *
 * @example
 * const obj = { user: { name: 'Alice' } };
 * const accessor = new ObjectAccessor(parser).from(obj);
 * accessor.get('user.name'); // 'Alice'
 */
export class ObjectAccessor extends AbstractAccessor {
    /**
     * Hydrate from a JavaScript object.
     *
     * @param data - Object input.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When input is not an object.
     * @throws {SecurityException} When data contains forbidden keys or exceeds depth limit.
     *
     * @example
     * accessor.from({ name: 'Alice', age: 30 });
     */
    from(data: unknown): this {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            throw new InvalidFormatException(
                `ObjectAccessor expects an object, got ${Array.isArray(data) ? 'array' : typeof data}`,
            );
        }

        return this.ingest(data);
    }

    /** {@inheritDoc} */
    protected parse(raw: unknown): Record<string, unknown> {
        return this.objectToRecord(raw as Record<string, unknown>, 0);
    }

    /**
     * Recursively convert a nested object into a plain record.
     *
     * @param value - Object to convert.
     * @param depth - Current recursion depth.
     * @returns Converted record.
     *
     * @throws {SecurityException} When recursion depth exceeds the configured maximum.
     */
    private objectToRecord(value: Record<string, unknown>, depth: number): Record<string, unknown> {
        const maxDepth = this.parser.getMaxDepth();

        if (depth > maxDepth) {
            throw new SecurityException(`Object depth ${depth} exceeds maximum of ${maxDepth}.`);
        }

        const result: Record<string, unknown> = {};

        for (const [key, val] of Object.entries(value)) {
            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                result[key] = this.objectToRecord(val as Record<string, unknown>, depth + 1);
            } else if (Array.isArray(val)) {
                result[key] = this.convertArrayValues(val, depth + 1);
            } else {
                result[key] = val;
            }
        }

        return result;
    }

    /**
     * Recursively convert nested arrays containing objects.
     *
     * @param array - Array to process.
     * @param depth - Current recursion depth.
     * @returns Array with all objects converted.
     *
     * @throws {SecurityException} When recursion depth exceeds the configured maximum.
     */
    private convertArrayValues(array: unknown[], depth: number): unknown[] {
        const maxDepth = this.parser.getMaxDepth();

        if (depth > maxDepth) {
            /* Stryker disable next-line StringLiteral -- error message content is cosmetic; test asserts exception type only */
            throw new SecurityException(`Object depth ${depth} exceeds maximum of ${maxDepth}.`);
        }

        return array.map((val) => {
            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                return this.objectToRecord(val as Record<string, unknown>, depth + 1);
            } else if (Array.isArray(val)) {
                return this.convertArrayValues(val, depth + 1);
            }
            return val;
        });
    }
}
