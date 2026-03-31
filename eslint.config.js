import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.es2022,
            },
        },
        rules: {
            // Errors
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-undef': 'error',
            'no-duplicate-imports': 'error',

            // Best practices
            'eqeqeq': ['error', 'always'],
            'no-var': 'error',
            'prefer-const': 'error',
            'prefer-arrow-callback': 'error',
            'no-return-await': 'error',
            'no-throw-literal': 'error',
            'no-promise-executor-return': 'error',

            // Node.js specific
            'no-process-exit': 'off', // We intentionally call process.exit in startup/shutdown
            'handle-callback-err': 'error',

            // Style (non-blocking — warnings only)
            'prefer-template': 'warn',
            'object-shorthand': 'warn',
        },
        ignores: ['node_modules/**', 'coverage/**', 'dist/**'],
    },
    {
        // Relax rules for test files
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
        rules: {
            'no-unused-vars': 'warn',
        },
    },
];
