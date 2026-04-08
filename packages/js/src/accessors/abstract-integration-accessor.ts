import { AbstractAccessor } from './abstract-accessor.js';
import type { ParseIntegrationInterface } from '../contracts/parse-integration-interface.js';
import type { ValidatableParserInterface } from '../contracts/validatable-parser-interface.js';

/**
 * Base accessor with custom format integration support.
 *
 * Extends {@link AbstractAccessor} to inject a {@link ParseIntegrationInterface}
 * for user-defined format detection and parsing. Used exclusively by
 * {@link AnyAccessor} to handle arbitrary input formats.
 *
 * @internal
 */
export abstract class AbstractIntegrationAccessor extends AbstractAccessor {
    /**
     * Create an accessor with parser and custom integration dependencies.
     *
     * @param parser - Dot-notation parser.
     * @param integration - Custom format parser.
     */
    constructor(
        parser: ValidatableParserInterface,
        protected readonly integration: ParseIntegrationInterface,
    ) {
        super(parser);
    }
}
