import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Shared ESLint configuration for all TypeScript packages in the monorepo.
 * Imported by packages/js/eslint.config.js and packages/cli/eslint.config.js.
 */
export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_" },
            ],
        },
    },
    {
        ignores: ["dist/", "node_modules/"],
    },
);
