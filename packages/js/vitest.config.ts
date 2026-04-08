import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: false,
        exclude: ['node_modules/**', '.stryker-tmp/**'],
        coverage: {
            reporter: ['text', 'json', 'clover'],
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts', 'src/contracts/**'],
            thresholds: {
                lines: 100,
                branches: 100,
                functions: 100,
                statements: 100,
            },
        },
    },
});
