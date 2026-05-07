// eslint.config.cjs — ESLint v9 flat config (replaces .eslintrc.js).
// Per Phase 999.17.3 D-09: full rewrite, NOT FlatCompat shim.
// Preserves verbatim semantics of 9 architectural override blocks from legacy .eslintrc.js.
// CommonJS export: root package.json has no "type":"module"; .cjs is unambiguous.
//
// Legacy `.eslintrc.js` extends chain (verbatim):
//   extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended']
// → @typescript-eslint/recommended itself extends `eslint-recommended` (which DISABLES
//   no-undef, no-redeclare, etc. — TS handles these). It does NOT extend `eslint:recommended`.
// → plugin:prettier/recommended extends `prettier` (eslint-config-prettier — 358 disables)
//   + enables `prettier/prettier: error` + disables `arrow-body-style` + `prefer-arrow-callback`.
//
// Flat-config equivalent:
//   - Spread `tsPlugin.configs['flat/recommended']` array (includes eslint-recommended off-list).
//   - Spread `prettierConfig.rules` (eslint-config-prettier flat-config rules block).
//   - Enable `prettier/prettier: 'error'` + disable `arrow-body-style` + `prefer-arrow-callback`.

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');
const checkFile = require('eslint-plugin-check-file');

module.exports = [
    // Global ignores (replaces legacy ignorePatterns ['dist/', 'node_modules/', '*.js'] verbatim per D-09)
    {
        ignores: ['**/dist/', '**/node_modules/', '**/*.js'],
    },

    // typescript-eslint flat/recommended chain — preserves legacy `extends: ['plugin:@typescript-eslint/recommended']`
    // (which itself extends eslint-recommended off-list to disable TS-redundant base rules).
    ...tsPlugin.configs['flat/recommended'],

    // Base TS rules — applies to all .ts files
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            prettier: prettierPlugin,
            'check-file': checkFile,
        },
        rules: {
            // preserves legacy `extends: ['plugin:prettier/recommended']` chain
            ...prettierConfig.rules, // eslint-config-prettier (358 formatting-rule disables)
            'prettier/prettier': 'error',
            'arrow-body-style': 'off',
            'prefer-arrow-callback': 'off',
            // legacy explicit rule overrides (preserved verbatim from `.eslintrc.js` lines 13-22)
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-empty-function': 'warn',
        },
    },

    // Override 1: contracts is leaf — cannot import other workspace packages.
    // Preserves verbatim semantics of legacy .eslintrc.js lines 23-43.
    {
        files: ['packages/contracts/src/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '@email-platform/config',
                                '@email-platform/config/*',
                                '@email-platform/foundation',
                                '@email-platform/foundation/*',
                                '@email-platform/gateway',
                                '@email-platform/gateway/*',
                                '@email-platform/auth',
                                '@email-platform/auth/*',
                                '@email-platform/sender',
                                '@email-platform/sender/*',
                                '@email-platform/parser',
                                '@email-platform/parser/*',
                                '@email-platform/audience',
                                '@email-platform/audience/*',
                                '@email-platform/notifier',
                                '@email-platform/notifier/*',
                            ],
                            message:
                                'contracts is a leaf package — cannot import other workspace packages.',
                        },
                    ],
                },
            ],
        },
    },

    // Override 2: config — direction contracts→config→foundation→apps.
    // Preserves verbatim semantics of legacy .eslintrc.js lines 44-62.
    {
        files: ['packages/config/src/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '@email-platform/foundation',
                                '@email-platform/foundation/*',
                                '@email-platform/gateway',
                                '@email-platform/gateway/*',
                                '@email-platform/auth',
                                '@email-platform/auth/*',
                                '@email-platform/sender',
                                '@email-platform/sender/*',
                                '@email-platform/parser',
                                '@email-platform/parser/*',
                                '@email-platform/audience',
                                '@email-platform/audience/*',
                                '@email-platform/notifier',
                                '@email-platform/notifier/*',
                            ],
                            message:
                                'config cannot import foundation or apps. Direction: contracts→config→foundation→apps.',
                        },
                    ],
                },
            ],
        },
    },

    // Override 3: foundation — direction contracts→config→foundation→apps.
    // Preserves verbatim semantics of legacy .eslintrc.js lines 63-81.
    {
        files: ['packages/foundation/src/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '@email-platform/contracts',
                                '@email-platform/contracts/*',
                                '@email-platform/gateway',
                                '@email-platform/gateway/*',
                                '@email-platform/auth',
                                '@email-platform/auth/*',
                                '@email-platform/sender',
                                '@email-platform/sender/*',
                                '@email-platform/parser',
                                '@email-platform/parser/*',
                                '@email-platform/audience',
                                '@email-platform/audience/*',
                                '@email-platform/notifier',
                                '@email-platform/notifier/*',
                            ],
                            message:
                                'foundation cannot import contracts or apps. Direction: contracts→config→foundation→apps.',
                        },
                    ],
                },
            ],
        },
    },

    // Override 4: apps/*/src — block sibling apps + foundation/internal + ioredis.
    // Preserves verbatim semantics of legacy .eslintrc.js lines 82-107.
    {
        files: ['apps/*/src/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '@email-platform/gateway',
                                '@email-platform/gateway/*',
                                '@email-platform/auth',
                                '@email-platform/auth/*',
                                '@email-platform/sender',
                                '@email-platform/sender/*',
                                '@email-platform/parser',
                                '@email-platform/parser/*',
                                '@email-platform/audience',
                                '@email-platform/audience/*',
                                '@email-platform/notifier',
                                '@email-platform/notifier/*',
                                '@email-platform/foundation/internal',
                                '@email-platform/foundation/internal/*',
                            ],
                            message:
                                'Apps cannot import from other apps or from foundation internal. Use contracts for shared types; wrap internal primitives in infrastructure/.',
                        },
                        {
                            group: ['ioredis', 'ioredis/*'],
                            message:
                                'Apps must not import ioredis directly — use CACHE_SERVICE token from @email-platform/foundation. See .agents/skills/infrastructure-client-layering/SKILL.md and Phase 999.12 D-08.',
                        },
                        {
                            group: ['pg', 'pg/*'],
                            message:
                                'Apps must not import pg directly — use DRIZZLE token from @email-platform/foundation. See .claude/skills/infrastructure-client-layering/SKILL.md and Phase 999.19 F-02.',
                        },
                    ],
                },
            ],
        },
    },

    // Override 5: apps/*/src/infrastructure — same as Override 4 minus ioredis (infrastructure may use Redis via narrow-unlock); pg banned in both per Phase 999.19 F-02 V2.
    // Preserves verbatim semantics of legacy .eslintrc.js lines 108-125.
    {
        files: ['apps/*/src/infrastructure/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '@email-platform/gateway',
                                '@email-platform/gateway/*',
                                '@email-platform/auth',
                                '@email-platform/auth/*',
                                '@email-platform/sender',
                                '@email-platform/sender/*',
                                '@email-platform/parser',
                                '@email-platform/parser/*',
                                '@email-platform/audience',
                                '@email-platform/audience/*',
                                '@email-platform/notifier',
                                '@email-platform/notifier/*',
                            ],
                            message:
                                'Apps cannot import from other apps. Use contracts for shared types. (Foundation internal is allowed in infrastructure/ per Phase 22.1.)',
                        },
                        {
                            group: ['pg', 'pg/*'],
                            message:
                                'Apps must not import pg directly — use DRIZZLE token from @email-platform/foundation. See .claude/skills/infrastructure-client-layering/SKILL.md and Phase 999.19 F-02.',
                        },
                    ],
                },
            ],
        },
    },

    // Override 6: Forbid @Injectable() and @Inject() on gRPC client classes (D-07 + D-12a, 999.7.1)
    //             AND forbid ANY `extends` on gRPC client classes (D-16, 999.7.2).
    // Rationale: gRPC clients are wired via useFactory — decorators are dead code.
    //            Inheritance is replaced by composition via injected GrpcCaller.
    //            See .agents/skills/infrastructure-client-layering/SKILL.md
    //            and .agents/skills/composition-over-inheritance/SKILL.md.
    // SCOPE: enumerated 8 gRPC upstream paths (HTTP clients legitimately extend AbstractHttpClient).
    // Preserves verbatim semantics of legacy .eslintrc.js lines 126-160.
    {
        files: [
            'apps/gateway/src/infrastructure/outbound/grpc-clients/auth/*.client.ts',
            'apps/gateway/src/infrastructure/outbound/grpc-clients/sender/*.client.ts',
            'apps/gateway/src/infrastructure/outbound/grpc-clients/parser/*.client.ts',
            'apps/gateway/src/infrastructure/outbound/grpc-clients/audience/*.client.ts',
            'apps/gateway/src/infrastructure/outbound/grpc-clients/notifier/*.client.ts',
            'apps/sender/src/infrastructure/outbound/grpc-clients/audience/*.client.ts',
            'apps/parser/src/infrastructure/outbound/grpc-clients/notifier/*.client.ts',
            'apps/audience/src/infrastructure/outbound/grpc-clients/parser/*.client.ts',
        ],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        'ClassDeclaration > Decorator > CallExpression[callee.name="Injectable"]',
                    message:
                        'gRPC client classes are wired via useFactory; @Injectable() is dead code and leaks wiring concern. See .agents/skills/infrastructure-client-layering/SKILL.md.',
                },
                {
                    selector:
                        'MethodDefinition[kind="constructor"] Decorator > CallExpression[callee.name="Inject"]',
                    message:
                        'gRPC client classes are wired via useFactory; @Inject() decorator on constructor params is ignored. Pass tokens via factory inject array.',
                },
                {
                    selector: 'ClassDeclaration[superClass]',
                    message:
                        'gRPC client facade must not extend any base class — use injected GrpcCaller via composition. See .agents/skills/composition-over-inheritance/SKILL.md and .agents/skills/infrastructure-client-layering/SKILL.md.',
                },
            ],
        },
    },

    // Override 7: Forbid creation of *-client.constants.ts files in gRPC client paths (D-05 + D-12b).
    // Rationale: token names are derived inside defineGrpcClient(); apps re-export named consts
    // (AUTH_CLIENT_GRPC = grpc.grpcToken) directly in the *-client.module.ts file.
    // SCOPE: enumerated 8 gRPC upstream paths (Pitfall 3 — HTTP clients legitimately use *-client.constants.ts).
    // Preserves verbatim semantics of legacy .eslintrc.js lines 161-181.
    {
        files: [
            'apps/gateway/src/infrastructure/outbound/grpc-clients/auth/**',
            'apps/gateway/src/infrastructure/outbound/grpc-clients/sender/**',
            'apps/gateway/src/infrastructure/outbound/grpc-clients/parser/**',
            'apps/gateway/src/infrastructure/outbound/grpc-clients/audience/**',
            'apps/gateway/src/infrastructure/outbound/grpc-clients/notifier/**',
            'apps/sender/src/infrastructure/outbound/grpc-clients/audience/**',
            'apps/parser/src/infrastructure/outbound/grpc-clients/notifier/**',
            'apps/audience/src/infrastructure/outbound/grpc-clients/parser/**',
        ],
        rules: {
            'check-file/filename-blocklist': [
                'error',
                {
                    '**/*-client.constants.ts':
                        '*-client.module.ts (re-export named tokens via grpc.grpcToken / grpc.healthToken)',
                },
            ],
        },
    },

    // Override 8: Domain layer isolation (D-06 + D-18, Phase 999.10).
    // Domain is pure TypeScript — no NestJS DI, no gRPC transport, no proto types,
    // no Drizzle ORM, no pg driver. Domain entities / VOs / domain services / events
    // must be framework-free so the business logic survives re-ORM / re-transport.
    // Preserves verbatim semantics of legacy .eslintrc.js lines 182-205.
    {
        files: ['apps/*/src/domain/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '@nestjs/*',
                                '@grpc/*',
                                '@email-platform/contracts',
                                '@email-platform/contracts/*',
                                'drizzle-orm',
                                'drizzle-orm/*',
                                'pg',
                                'pg/*',
                            ],
                            message:
                                'domain/ layer is pure TypeScript — no NestJS, no proto, no Drizzle, no pg driver. See .agents/skills/clean-ddd-hexagonal/SKILL.md (Dependency Rule) and .agents/skills/nestjs-hexagonal-mapping/ (Proto Visibility).',
                        },
                    ],
                },
            ],
        },
    },

    // Override 9: Application layer isolation (D-04 + D-05 + D-18, Phase 999.10 + 999.11.2).
    // application/ = ports + services + use cases + commands. Domain types only.
    // Transport contracts (proto) live ONLY in infrastructure/inbound/grpc/ and infrastructure/outbound/grpc-clients/.
    // @nestjs/microservices decorators (GrpcMethod, MessagePattern, etc.) are infrastructure concerns.
    // Preserves verbatim semantics of legacy .eslintrc.js lines 206-232.
    {
        files: ['apps/*/src/application/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['@email-platform/contracts', '@email-platform/contracts/*'],
                            message:
                                'application/ layer must not import proto types. gRPC controllers (infrastructure/inbound/grpc/) and outbound gRPC clients (infrastructure/outbound/grpc-clients/) own the proto↔domain mapping. See .agents/skills/nestjs-hexagonal-mapping/ (D-04, Proto Visibility).',
                        },
                        {
                            group: ['@nestjs/microservices', '@nestjs/microservices/*'],
                            message:
                                '@nestjs/microservices is a transport-adapter concern. GrpcMethod / GrpcStreamMethod / MessagePattern / EventPattern belong in infrastructure/inbound/{grpc,rmq}/. application/ layer is transport-agnostic. See .agents/skills/nestjs-hexagonal-mapping/.',
                        },
                    ],
                },
            ],
        },
    },
];
