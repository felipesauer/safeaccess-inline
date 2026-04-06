import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: false,
        coverage: {
            include: ['src/**/*.ts'],
            exclude: [
                'src/index.ts',
            ],
            thresholds: {
                lines: 100,
                branches: 100,
                functions: 100,
                statements: 100,
            },
        },
    },
});
