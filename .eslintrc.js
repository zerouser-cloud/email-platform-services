module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint', 'prettier'],
    extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
    ],
    rules: {
        '@typescript-eslint/no-unused-vars': [
            'warn',
            { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-empty-function': 'warn',
    },
    overrides: [
        {
            files: ['packages/contracts/src/**/*.ts'],
            rules: {
                'no-restricted-imports': ['error', {
                    patterns: [{
                        group: [
                            '@email-platform/config', '@email-platform/config/*',
                            '@email-platform/foundation', '@email-platform/foundation/*',
                            '@email-platform/gateway', '@email-platform/gateway/*',
                            '@email-platform/auth', '@email-platform/auth/*',
                            '@email-platform/sender', '@email-platform/sender/*',
                            '@email-platform/parser', '@email-platform/parser/*',
                            '@email-platform/audience', '@email-platform/audience/*',
                            '@email-platform/notifier', '@email-platform/notifier/*',
                        ],
                        message: 'contracts is a leaf package — cannot import other workspace packages.',
                    }],
                }],
            },
        },
        {
            files: ['packages/config/src/**/*.ts'],
            rules: {
                'no-restricted-imports': ['error', {
                    patterns: [{
                        group: [
                            '@email-platform/foundation', '@email-platform/foundation/*',
                            '@email-platform/gateway', '@email-platform/gateway/*',
                            '@email-platform/auth', '@email-platform/auth/*',
                            '@email-platform/sender', '@email-platform/sender/*',
                            '@email-platform/parser', '@email-platform/parser/*',
                            '@email-platform/audience', '@email-platform/audience/*',
                            '@email-platform/notifier', '@email-platform/notifier/*',
                        ],
                        message: 'config cannot import foundation or apps. Direction: contracts→config→foundation→apps.',
                    }],
                }],
            },
        },
        {
            files: ['packages/foundation/src/**/*.ts'],
            rules: {
                'no-restricted-imports': ['error', {
                    patterns: [{
                        group: [
                            '@email-platform/gateway', '@email-platform/gateway/*',
                            '@email-platform/auth', '@email-platform/auth/*',
                            '@email-platform/sender', '@email-platform/sender/*',
                            '@email-platform/parser', '@email-platform/parser/*',
                            '@email-platform/audience', '@email-platform/audience/*',
                            '@email-platform/notifier', '@email-platform/notifier/*',
                        ],
                        message: 'foundation cannot import apps. Direction: contracts→config→foundation→apps.',
                    }],
                }],
            },
        },
        {
            files: ['apps/*/src/**/*.ts'],
            rules: {
                'no-restricted-imports': ['error', {
                    patterns: [{
                        group: [
                            '@email-platform/gateway', '@email-platform/gateway/*',
                            '@email-platform/auth', '@email-platform/auth/*',
                            '@email-platform/sender', '@email-platform/sender/*',
                            '@email-platform/parser', '@email-platform/parser/*',
                            '@email-platform/audience', '@email-platform/audience/*',
                            '@email-platform/notifier', '@email-platform/notifier/*',
                        ],
                        message: 'Apps cannot import from other apps. Use contracts for shared types.',
                    }],
                }],
            },
        },
    ],
    ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};
