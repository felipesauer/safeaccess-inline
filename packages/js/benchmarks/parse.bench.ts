import { bench, describe } from 'vitest';
import { Inline } from '../src/inline.js';

const arrayPayload = {
    user: { profile: { name: 'Alice', age: 30 } },
    config: { debug: false, version: '1.0.0' },
};

const jsonPayload = JSON.stringify(arrayPayload);

const yamlPayload = `user:
  profile:
    name: Alice
    age: 30
config:
  debug: false
  version: '1.0.0'
`;

const iniPayload = `[config]
debug=false
version=1.0.0
`;

describe('Inline.from* (parse)', () => {
    bench('fromArray', () => {
        Inline.fromArray(arrayPayload);
    });

    bench('fromJson', () => {
        Inline.fromJson(jsonPayload);
    });

    bench('fromYaml', () => {
        Inline.fromYaml(yamlPayload);
    });

    bench('fromIni', () => {
        Inline.fromIni(iniPayload);
    });
});
