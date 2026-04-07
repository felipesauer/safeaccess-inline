import { bench, describe } from 'vitest';
import { Inline } from '../src/inline.js';

const accessor = Inline.fromArray({
    user: { profile: { name: 'Alice', age: 30 } },
    config: { debug: false, version: '1.0.0' },
    items: [1, 2, 3, 4, 5],
});

describe('ArrayAccessor.get', () => {
    bench('shallow key', () => {
        accessor.get('config.debug');
    });

    bench('deep key (3 levels)', () => {
        accessor.get('user.profile.name');
    });

    bench('missing key with default', () => {
        accessor.get('user.profile.missing', null);
    });

    bench('repeated path (cache)', () => {
        accessor.get('user.profile.name');
    });
});
