module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint', 'prettier', 'check-file'],
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
                            '@email-platform/contracts', '@email-platform/contracts/*',
                            '@email-platform/gateway', '@email-platform/gateway/*',
                            '@email-platform/auth', '@email-platform/auth/*',
                            '@email-platform/sender', '@email-platform/sender/*',
                            '@email-platform/parser', '@email-platform/parser/*',
                            '@email-platform/audience', '@email-platform/audience/*',
                            '@email-platform/notifier', '@email-platform/notifier/*',
                        ],
                        message: 'foundation cannot import contracts or apps. Direction: contracts→config→foundation→apps.',
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
                            '@email-platform/foundation/internal',
                            '@email-platform/foundation/internal/*',
                        ],
                        message: 'Apps cannot import from other apps or from foundation internal. Use contracts for shared types; wrap internal primitives in infrastructure/.',
                    }],
                }],
            },
        },
        {
            files: ['apps/*/src/infrastructure/**/*.ts'],
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
                        message: 'Apps cannot import from other apps. Use contracts for shared types. (Foundation internal is allowed in infrastructure/ per Phase 22.1.)',
                    }],
                }],
            },
        },
        // Override 6: Forbid @Injectable() and @Inject() on gRPC client classes (D-07 + D-12a).
        // Rationale: gRPC clients are wired via useFactory; decorators are dead code and leak wiring concern
        // into the domain class. See .agents/skills/infrastructure-client-layering/SKILL.md.
        // SCOPE: enumerated 8 gRPC upstream paths (Pitfall 3 — must NOT match HTTP clients).
        {
            files: [
                'apps/gateway/src/infrastructure/clients/auth/*.client.ts',
                'apps/gateway/src/infrastructure/clients/sender/*.client.ts',
                'apps/gateway/src/infrastructure/clients/parser/*.client.ts',
                'apps/gateway/src/infrastructure/clients/audience/*.client.ts',
                'apps/gateway/src/infrastructure/clients/notifier/*.client.ts',
                'apps/sender/src/infrastructure/clients/audience/*.client.ts',
                'apps/parser/src/infrastructure/clients/notifier/*.client.ts',
                'apps/audience/src/infrastructure/clients/parser/*.client.ts',
            ],
            rules: {
                'no-restricted-syntax': ['error',
                    {
                        selector: 'ClassDeclaration > Decorator > CallExpression[callee.name="Injectable"]',
                        message: 'gRPC client classes are wired via useFactory; @Injectable() is dead code and leaks wiring concern. See .agents/skills/infrastructure-client-layering/SKILL.md.',
                    },
                    {
                        selector: 'MethodDefinition[kind="constructor"] Decorator > CallExpression[callee.name="Inject"]',
                        message: 'gRPC client classes are wired via useFactory; @Inject() decorator on constructor params is ignored. Pass tokens via factory inject array.',
                    },
                ],
            },
        },
        // Override 7: Forbid creation of *-client.constants.ts files in gRPC client paths (D-05 + D-12b).
        // Rationale: token names are derived inside defineGrpcClient(); apps re-export named consts
        // (AUTH_CLIENT_GRPC = grpc.grpcToken) directly in the *-client.module.ts file.
        // SCOPE: enumerated 8 gRPC upstream paths (Pitfall 3 — HTTP clients legitimately use *-client.constants.ts).
        {
            files: [
                'apps/gateway/src/infrastructure/clients/auth/**',
                'apps/gateway/src/infrastructure/clients/sender/**',
                'apps/gateway/src/infrastructure/clients/parser/**',
                'apps/gateway/src/infrastructure/clients/audience/**',
                'apps/gateway/src/infrastructure/clients/notifier/**',
                'apps/sender/src/infrastructure/clients/audience/**',
                'apps/parser/src/infrastructure/clients/notifier/**',
                'apps/audience/src/infrastructure/clients/parser/**',
            ],
            rules: {
                'check-file/filename-blocklist': ['error', {
                    '**/*-client.constants.ts': '*-client.module.ts (re-export named tokens via grpc.grpcToken / grpc.healthToken)',
                }],
            },
        },
    ],
    ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};
