# Error Solutions — Архитектура ошибок для email-platform

Решения на базе ERROR-LANDSCAPE.md. Принципы: чистота слоёв, минимальная сложность, типобезопасность.

---

## 1. Стратегическое решение: Result вместо throw

### Проблема с exceptions

В чистой DDD-архитектуре exceptions создают проблемы:
- Domain layer бросает exception → он "пролетает" через все слои до filter
- Нет типобезопасности — сигнатура `createUser(): User` не сообщает что может быть ошибка
- Невозможно отличить "бизнес-отказ" от "сбой системы" по типу
- Partial failure невозможен — один throw отменяет всё

### Решение: neverthrow

**Библиотека:** `neverthrow` (~1.6M downloads/week, стабильный v8.2.0)

**Почему neverthrow:**
- `ResultAsync<T, E>` — критично для async NestJS (DB, gRPC, external APIs)
- Цепочки `.andThen()`, `.map()`, `.mapErr()` без callback hell
- `safeTry` — generator do-notation для сложных цепочек
- ~4kB, zero dependencies
- Отличный type narrowing в TypeScript

**Альтернативы и почему отклонены:**
- `effect` — полная effect-система, конфликтует с NestJS DI, weeks to learn
- `fp-ts` — maintenance mode, creator ушёл в Effect
- `true-myth` — нет `ResultAsync`, всё async через `Promise<Result>`
- `sweet-monads/either` — мёртв с 2023

### Где Result, где exception

```
Domain layer:       ВСЕГДА Result<T, DomainError>     (чистый, типобезопасный)
Application layer:  ВСЕГДА ResultAsync<T, AppError>    (оркестрация, async)
Infrastructure:     throw → ловит адаптер → Result     (граница перевода)
Transport:          Result → exception (в filter/controller для фреймворка)
```

**Правило:** Result живёт внутри приложения. Exceptions живут на границе с фреймворком (NestJS filters, gRPC transport). Domain и Application никогда не throw.

---

## 2. Domain Patterns: Specification → Invariant → Value Object → Aggregate

### 2.1. Specification — атомарная проверка

Переиспользуемое, кэшируемое бизнес-правило. Возвращает `Result<T, DomainError>`.

```typescript
// domain/shared/specifications/specification.interface.ts

interface ISpecification<T> {
  isSatisfiedBy(value: T): Result<T, DomainError>;
}
```

```typescript
// domain/shared/specifications/common-not-empty.spec.ts

class CommonNotEmptySpec implements ISpecification<string> {
  private static readonly instances = new Map<string, CommonNotEmptySpec>();

  private constructor(private readonly entityType: string) {}

  static for(entityType: string): CommonNotEmptySpec {
    if (!this.instances.has(entityType)) {
      this.instances.set(entityType, new CommonNotEmptySpec(entityType));
    }
    return this.instances.get(entityType)!;
  }

  isSatisfiedBy(value: string): Result<string, DomainError> {
    if (value && value.trim().length > 0) {
      return ok(value);
    }
    return err(DomainErrors.validationFailed('cannot be empty', {
      entityType: this.entityType,
    }));
  }
}
```

```typescript
// domain/shared/specifications/common-length.spec.ts

interface LengthConfig {
  readonly entityType: string;
  readonly minLength: number;
  readonly maxLength: number;
}

class CommonLengthSpec implements ISpecification<string> {
  private static readonly instances = new Map<string, CommonLengthSpec>();

  private constructor(private readonly config: LengthConfig) {}

  static for(config: LengthConfig): CommonLengthSpec {
    const key = `${config.entityType}:${config.minLength}:${config.maxLength}`;
    if (!this.instances.has(key)) {
      this.instances.set(key, new CommonLengthSpec(config));
    }
    return this.instances.get(key)!;
  }

  isSatisfiedBy(value: string): Result<string, DomainError> {
    if (value.length >= this.config.minLength && value.length <= this.config.maxLength) {
      return ok(value);
    }
    return err(DomainErrors.validationFailed(
      `length must be between ${this.config.minLength} and ${this.config.maxLength}`,
      { entityType: this.config.entityType, actual: value.length },
    ));
  }
}
```

**Flyweight pattern:** Спецификации кэшируются — одинаковые правила не пересоздаются.

**Спецификации generic** — они не знают кто их вызвал. Контекст (entityType) добавляется на уровне Value Object через utility-функцию `withEntity`.

### 2.2. withEntity — обогащение ошибок контекстом

Спецификации возвращают ошибки без entityType. Value Object оборачивает их:

```typescript
// domain/shared/errors.ts

function withEntity<T>(
  entityType: string,
  result: Result<T, DomainError[]>,
): Result<T, DomainError[]> {
  return result.mapErr((errs) =>
    errs.flat().map((e) => ({
      ...e,
      context: { ...e.context, entityType },
    }))
  );
}
```

### 2.3. Invariant — композиция спецификаций с аккумуляцией

Инвариант объединяет несколько спецификаций и **аккумулирует все ошибки**.

```typescript
// domain/shared/invariants/invariant.interface.ts

interface IInvariant<T> {
  validate(value: T): Result<T, DomainError[]>;
}
```

```typescript
// domain/shared/invariants/resource-name.invariant.ts

class ResourceNameInvariant implements IInvariant<string> {
  private static readonly MIN_LENGTH = 1;
  private static readonly MAX_LENGTH = 100;
  private static readonly instance = new ResourceNameInvariant();

  private constructor() {}

  static get singleton(): ResourceNameInvariant {
    return ResourceNameInvariant.instance;
  }

  validate(value: string): Result<string, DomainError[]> {
    // combineWithAllErrors собирает ВСЕ ошибки, не останавливается на первой
    return Result.combineWithAllErrors([
      notEmptySpec.isSatisfiedBy(value),
      lengthSpec(
        ResourceNameInvariant.MIN_LENGTH,
        ResourceNameInvariant.MAX_LENGTH,
      ).isSatisfiedBy(value),
    ])
      .map(() => value)                // [string, string] → string
      .mapErr((errs) => errs.flat());  // DomainError[][] → DomainError[]
  }
}
```

Инвариант не знает entityType — он проверяет правила. Контекст добавляет VO.

### 2.4. Value Object — create() vs reconstitute()

```typescript
// domain/campaign/value-objects/campaign-name.ts

class CampaignName {
  private static readonly ENTITY_TYPE = 'CampaignName';

  private constructor(private readonly value: string) {}

  // Пользовательский ввод → полная валидация + контекст entityType
  static create(raw: string): Result<CampaignName, DomainError[]> {
    return withEntity(CampaignName.ENTITY_TYPE,
      ResourceNameInvariant.singleton.validate(raw)
    ).map((valid) => new CampaignName(valid));
  }

  // Из БД → доверяем, без валидации
  static reconstitute(value: string): CampaignName {
    return new CampaignName(value);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: CampaignName): boolean {
    return this.value === other.value;
  }
}
```

```typescript
// domain/auth/value-objects/email.ts

class Email {
  private static readonly ENTITY_TYPE = 'Email';

  private constructor(readonly value: string) {}

  static create(raw: string): Result<Email, DomainError[]> {
    return withEntity(Email.ENTITY_TYPE,
      Result.combineWithAllErrors([
        notEmptySpec.isSatisfiedBy(raw),
        emailFormatSpec.isSatisfiedBy(raw),
      ])
    ).map(() => new Email(raw));
  }

  static reconstitute(value: string): Email {
    return new Email(value);
  }
}
```

**Паттерн:** `withEntity(TYPE, combineWithAllErrors([...specs])).map(construct)` — единообразен для всех VO.

### 2.5. Aggregate — комбинирует validated VOs с аккумуляцией

```typescript
// domain/campaign/aggregate/campaign.ts

class Campaign {
  private constructor(private readonly props: CampaignProps) {}

  static create(
    name: Result<CampaignName, DomainError[]>,
    subject: Result<EmailSubject, DomainError[]>,
    groupId: RecipientGroupId,
  ): Result<Campaign, DomainError[]> {
    // Аккумулирует ошибки из ВСЕХ Value Objects
    return Result.combineWithAllErrors([name, subject])
      .mapErr((nested) => nested.flat())  // DomainError[][] → DomainError[]
      .map(([validName, validSubject]) =>
        new Campaign({
          id: CampaignId.generate(),
          name: validName,
          subject: validSubject,
          groupId,
          status: CampaignStatus.DRAFT,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
  }

  static reconstitute(data: CampaignDocument): Campaign {
    return new Campaign({
      id: CampaignId.reconstitute(data._id),
      name: CampaignName.reconstitute(data.name),
      subject: EmailSubject.reconstitute(data.subject),
      groupId: RecipientGroupId.reconstitute(data.groupId),
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
```

**Что получает фронт при ошибке:**

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "violations": [
    { "entityType": "CampaignName", "code": "VALIDATION_FAILED", "message": "cannot be empty" },
    { "entityType": "EmailSubject", "code": "VALIDATION_FAILED", "message": "length must be between 1 and 200" }
  ]
}
```

Все ошибки за один запрос, каждая с entityType — фронт знает какое поле подсветить.

---

## 3. Иерархия ошибок по слоям

### 3.1. Domain Errors

Чистый TypeScript, zero dependencies. Discriminated union для pattern matching.

```typescript
// domain/shared/errors.ts

type DomainErrorCode =
  | 'VALIDATION_FAILED'
  | 'INVARIANT_VIOLATED'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'CONFLICT';

interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

// Фабрики — не классы, чтобы domain оставался без наследования
const DomainErrors = {
  validationFailed: (message: string, context?: Record<string, unknown>): DomainError =>
    ({ code: 'VALIDATION_FAILED', message, context }),

  invariantViolated: (message: string, context?: Record<string, unknown>): DomainError =>
    ({ code: 'INVARIANT_VIOLATED', message, context }),

  notFound: (entity: string, id: string): DomainError =>
    ({ code: 'NOT_FOUND', message: `${entity} not found`, context: { entity, id } }),

  alreadyExists: (entity: string, field: string, value: string): DomainError =>
    ({ code: 'ALREADY_EXISTS', message: `${entity} with ${field} already exists`, context: { entity, field, value } }),

  conflict: (message: string, context?: Record<string, unknown>): DomainError =>
    ({ code: 'CONFLICT', message, context }),
} as const;
```

### 3.2. Application Errors

Расширяет domain errors контекстом use case.

```typescript
// application/shared/errors.ts

type AppErrorCode =
  | DomainErrorCode           // все доменные коды
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'PRECONDITION_FAILED'
  | 'OPERATION_TIMEOUT'
  | 'EXTERNAL_SERVICE_FAILED'
  | 'CONCURRENCY_CONFLICT';

interface AppError {
  readonly code: AppErrorCode;
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly cause?: DomainError;  // оригинальная доменная ошибка
}
```

---

## 4. Use Case — фазовая модель (accumulate → check → commit)

Use case разбивается на фазы с разными режимами обработки ошибок.

### 4.1. Кто что валидирует — без дублирования

Каждый тип проверки выполняется ровно один раз, в одном месте:

| Что проверяется | Где | Кто | Пример |
|---|---|---|---|
| Формат поля | `VO.create()` | Specification + Invariant | "email невалиден", "имя слишком короткое" |
| Уникальность в системе | Use case (фаза 2) | Repository через port | "email уже занят" |
| Комбинация полей агрегата | `Aggregate.create()` | Агрегатный инвариант | "URGENT-кампания требует subject < 50 символов" |
| Бизнес-состояние entity | Entity method | Entity инвариант | "кампания в статусе SENT не может быть изменена" |

**Use case не знает правил валидации полей** — он вызывает `Email.create(cmd.email)`, а VO внутри себя запускает спецификации. Use case только собирает результаты и аккумулирует ошибки.

**Агрегат не перевалидирует VO** — он получает `Email`, `UserName` (уже валидные, private constructor гарантирует). Агрегат проверяет только свои инварианты — правила на комбинацию полей или бизнес-состояние.

```typescript
class Campaign {
  static create(
    name: CampaignName,        // уже валидный VO
    subject: EmailSubject,      // уже валидный VO
    groupId: RecipientGroupId,  // уже валидный VO
  ): Result<Campaign, DomainError[]> {
    // VO-валидация уже пройдена
    // Тут только АГРЕГАТНЫЕ инварианты (если есть)
    return ok(new Campaign({ name, subject, groupId, ... }));
  }
}
```

### 4.2. Application utilities — единообразный стиль

Три utility для use case, аналогичные `withEntity` в domain:

```typescript
// application/shared/result-utils.ts

/**
 * Фаза 1: Комбинирует sync-валидации VO с аккумуляцией.
 * DomainError[][] → flat → AppError
 */
function combineValidations<T extends Result<unknown, DomainError[]>[]>(
  results: [...T],
): Result<{ [K in keyof T]: T[K] extends Result<infer V, unknown> ? V : never }, AppError> {
  return Result.combineWithAllErrors(results)
    .mapErr((nested) => nested.flat())
    .mapErr(toAppValidationError);
}

/**
 * Фаза 2: Комбинирует async бизнес-проверки с аккумуляцией.
 * AppError[] → combined AppError
 */
function combineChecks<T extends ResultAsync<unknown, AppError>[]>(
  checks: [...T],
): ResultAsync<{ [K in keyof T]: T[K] extends ResultAsync<infer V, unknown> ? V : never }, AppError> {
  return ResultAsync.combineWithAllErrors(checks)
    .mapErr(toAppCombinedError);
}
```

| Слой | Utility | Что делает |
|---|---|---|
| Domain (VO) | `withEntity(type, result)` | Добавляет entityType к DomainError[] |
| Application (sync validation) | `combineValidations([...])` | DomainError[][] → flat → AppError |
| Application (async checks) | `combineChecks([...])` | AppError[] → combined AppError |

### 4.3. Простой use case (без Pipeline)

```typescript
class CreateUserUseCase {
  execute(cmd: CreateUserCmd): ResultAsync<User, AppError> {
    // ФАЗА 1: Валидация Value Objects (accumulate, sync, без I/O)
    // Все ошибки собираются — фронт получает полный список
    const validated = combineValidations([
      Email.create(cmd.email),
      UserName.create(cmd.name),
    ]);

    // ФАЗА 2: Бизнес-проверки (accumulate, async, I/O)
    // Независимые проверки тоже аккумулируются
    return ResultAsync.fromResult(validated)
      .andThen(([email, name]) =>
        combineChecks([
          this.checkEmailUnique(email),
          this.checkNameUnique(name),
        ]).map(() => [email, name] as const)
      )
      // ФАЗА 3: Создание + сохранение (fail-fast, зависимая цепочка)
      // Если create упал — save бессмысленен
      .andThen(([email, name]) =>
        User.create(email, name)
          .mapErr(toAppError)
      )
      .andThen((user) =>
        ResultAsync.fromPromise(
          this.userRepo.save(user),
          toInfraError,
        )
      );
  }

  private checkEmailUnique(email: Email): ResultAsync<Email, AppError> {
    return ResultAsync.fromPromise(
      this.userRepo.findByEmail(email),
      toInfraError,
    ).andThen((existing) =>
      existing
        ? err(AppErrors.alreadyExists('User', 'email', email.getValue()))
        : ok(email)
    );
  }

  private checkNameUnique(name: UserName): ResultAsync<UserName, AppError> {
    return ResultAsync.fromPromise(
      this.userRepo.findByName(name),
      toInfraError,
    ).andThen((existing) =>
      existing
        ? err(AppErrors.alreadyExists('User', 'name', name.getValue()))
        : ok(name)
    );
  }
}
```

**Три фазы, два режима:**

```
Фаза 1: VO validation    → combineValidations  (sync)   → "email плохой И имя пустое"
Фаза 2: Business checks  → combineChecks        (async)  → "email занят И имя занято"
Фаза 3: Create + persist → .andThen() chain     (async)  → стоп на первой ошибке
```

### 4.4. Сложный use case (Pipeline для retry, compensation, mixed modes)

Для случаев когда нужны retry, saga-компенсации, условные шаги — Pipeline оправдан. В остальных 90% случаев достаточно Result chain выше.

```typescript
class ImportRecipientsUseCase {
  async execute(cmd: ImportRecipientsCmd): Promise<Result<BatchResult, AppError>> {
    return new Pipeline<ImportContext>()
      .validate((ctx) => this.validateInput(ctx))        // accumulate
      .validate((ctx) => this.checkGroupExists(ctx))     // accumulate
      .commit((ctx) => this.parseFile(ctx))               // fail-fast
      .commit((ctx) => this.persistRecipients(ctx), {     // fail-fast + retry
        retry: 3,
        compensate: (ctx) => this.deleteImported(ctx),
      })
      .execute({ command: cmd });
  }
}
```

### 3.3. Infrastructure Errors — перевод на границе

Инфраструктурный адаптер ОБЯЗАН перехватить технические ошибки и перевести в domain/app термины.

```typescript
// infrastructure/persistence/mongo-campaign.repository.ts

class MongoCampaignRepository implements CampaignRepositoryPort {
  async save(campaign: Campaign): Promise<Campaign> {
    try {
      await this.collection.insertOne(toDocument(campaign));
      return campaign;
    } catch (error) {
      // MongoDB duplicate key → доменный конфликт
      if (this.isDuplicateKeyError(error)) {
        throw new Error('ALREADY_EXISTS'); // будет пойман в use case через ResultAsync.fromPromise
      }
      // Всё остальное — инфраструктурный сбой
      throw error; // ResultAsync.fromPromise поймает и обернёт
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('E11000');
  }
}
```

**Ключевой принцип:** Repository знает про MongoDB. Use case не знает. Repository переводит MongoError в семантику, понятную application layer.

---

## 5. Поток конвертации (полный путь ошибки)

```
Domain:  Email.create("bad") → Result<Email, DomainError{VALIDATION_FAILED}>
              ↓
Application:  useCase.execute() → ResultAsync<T, AppError>
              ↓ .mapErr() оборачивает DomainError в AppError
              ↓
Infrastructure (inbound adapter — gRPC controller):
              ↓ result.match(ok => response, err => throw GrpcException)
              ↓
NestJS filter:  AllRpcExceptionsFilter ловит GrpcException → gRPC error
              ↓
gRPC transport:  отправляет error response
              ↓
Gateway filter:  GrpcToHttpExceptionFilter → HTTP response
              ↓
Client:  { statusCode: 400, message: "Invalid email", error: "Bad Request" }
```

**Точки конвертации (ровно 2):**

1. **gRPC controller** — `AppError → GrpcException` (маппинг кодов)
2. **Gateway filter** — `gRPC status → HTTP status` (уже реализован)

```typescript
// infrastructure/grpc/error-mapper.ts — маппинг AppError → GrpcException

const appErrorToGrpc: Record<AppErrorCode, () => typeof GrpcException> = {
  VALIDATION_FAILED:        () => GrpcInvalidArgumentException,
  INVARIANT_VIOLATED:       () => GrpcInvalidArgumentException,
  NOT_FOUND:                () => GrpcNotFoundException,
  ALREADY_EXISTS:           () => GrpcAlreadyExistsException,
  CONFLICT:                 () => GrpcAlreadyExistsException,
  UNAUTHORIZED:             () => GrpcUnauthenticatedException,
  FORBIDDEN:                () => GrpcPermissionDeniedException,
  PRECONDITION_FAILED:      () => GrpcInvalidArgumentException,
  OPERATION_TIMEOUT:        () => GrpcUnavailableException,
  EXTERNAL_SERVICE_FAILED:  () => GrpcInternalException,
  CONCURRENCY_CONFLICT:     () => GrpcAlreadyExistsException,
};

function toGrpcException(error: AppError): GrpcException {
  const ExceptionClass = appErrorToGrpc[error.code]();
  return new ExceptionClass(error.message, error.context);
}
```

**gRPC controller:**

```typescript
@GrpcMethod('SenderService', 'CreateCampaign')
async createCampaign(req: CreateCampaignReq): Promise<CreateCampaignRes> {
  const result = await this.createCampaignUseCase.execute(toCommand(req));

  return result.match(
    (campaign) => toProtoResponse(campaign),
    (error) => { throw toGrpcException(error); }
  );
}
```

---

## 6. Edge cases — решения

### 6.1. Reconstitution failure (битые данные из БД)

**Решение:** Repository ловит ошибку создания entity и бросает специальную ошибку.

```typescript
class MongoCampaignRepository implements CampaignRepositoryPort {
  async findById(id: string): Promise<Campaign | null> {
    const doc = await this.collection.findOne({ _id: id });
    if (!doc) return null;

    const result = Campaign.reconstitute(doc); // returns Result<Campaign, DomainError>
    if (result.isErr()) {
      this.logger.error({ id, error: result.error }, 'Data corruption: failed to reconstitute entity');
      throw new Error('DATA_CORRUPTION'); // пойман use case как EXTERNAL_SERVICE_FAILED
    }
    return result.value;
  }
}
```

**Принцип:** Reconstitution failure — это infrastructure error (данные повреждены в хранилище). Repository логирует alert, use case получает generic failure.

### 6.2. Duplicate key через MongoDB

**Решение:** Двухуровневая защита.

1. **Use case** проверяет уникальность через port (быстрая проверка):
```typescript
const existing = await this.userRepo.findByEmail(cmd.email);
if (existing) return err({ code: 'ALREADY_EXISTS', ... });
```

2. **Repository** ловит E11000 как fallback (race condition protection):
```typescript
// В save() — если между findByEmail и save кто-то вставил запись
catch (error) {
  if (isDuplicateKeyError(error)) {
    throw new Error('ALREADY_EXISTS');
  }
  throw error;
}
```

### 6.3. Partial failure в batch

**Решение:** Batch result type.

```typescript
interface BatchResult<T, E> {
  readonly succeeded: T[];
  readonly failed: Array<{ item: T; error: E }>;
  readonly total: number;
}

class ImportRecipientsUseCase {
  execute(cmd: ImportRecipientsCmd): ResultAsync<BatchResult<Recipient, DomainError>, AppError> {
    // Каждый recipient обрабатывается независимо
    // Ошибка одного НЕ останавливает остальных
    // AppError возвращается только если упала вся инфраструктура
  }
}
```

**gRPC response:** proto-сообщение включает `succeeded_count`, `failed_count`, `failures[]`.

### 6.4. Cascade timeout

**Решение:** Deadline propagation — каждый сервис вычитает свой overhead.

```typescript
// Sender получает deadline от Gateway: 5000ms
// Sender тратит ~50ms на свою работу
// Sender вызывает Audience с deadline: 5000 - 50 - buffer(100) = 4850ms

function propagateDeadline(incomingDeadlineMs: number, overheadMs: number, bufferMs = 100): number {
  const remaining = incomingDeadlineMs - overheadMs - bufferMs;
  if (remaining <= 0) throw new GrpcUnavailableException('Insufficient time budget');
  return remaining;
}
```

**При timeout:** Sender оборачивает ошибку с контекстом:
```typescript
{ code: 'OPERATION_TIMEOUT', message: 'Audience service timeout', context: { service: 'audience', method: 'GetRecipientsByGroup' } }
```

### 6.5. RabbitMQ event handler failure

**Решение:** Retry с dead letter.

```
Message → Consumer
  ├─ Success → ACK
  ├─ Transient error (DB down, API 429) → NACK + requeue (max 3 retries via header x-retry-count)
  └─ Permanent error (invalid data, business rule) → NACK + dead letter queue
```

**Dead letter queue** обрабатывается отдельным consumer с alerting.
**Idempotency:** Consumer проверяет `event_id` в Redis перед обработкой.

### 6.6. Optimistic locking conflict

**Решение:** Версия — часть агрегата. Проверка в repository.

```typescript
// Domain
class Campaign {
  readonly version: number;
  // ... бизнес-методы возвращают новый Campaign с version + 1
}

// Repository
async save(campaign: Campaign): Promise<Campaign> {
  const result = await this.collection.updateOne(
    { _id: campaign.id, version: campaign.version },  // CAS
    { $set: toDocument(campaign) }
  );
  if (result.matchedCount === 0) {
    throw new Error('CONCURRENCY_CONFLICT');
  }
  return campaign;
}
```

Use case получает `CONCURRENCY_CONFLICT` через `ResultAsync.fromPromise`.

---

## 7. Трассировка и логирование

> **Примечание:** Описание логирования в этом разделе предварительное. Конкретные решения по логгеру (Pino mixin, уровни, формат, sensitive data filtering) будут актуализированы после создания отдельного документа по логированию. Решения по OpenTelemetry tracing (trace ID propagation, auto-instrumentation) стабильны и не зависят от выбора логгера.

### 7.1. Решение: OpenTelemetry (минимальный setup)

**Пакеты (3 штуки):**

```
@opentelemetry/sdk-node               ^0.57.0
@opentelemetry/api                     ^1.9.0
@opentelemetry/auto-instrumentations-node  ^0.55.0
```

**Что даёт:**
- `traceId` + `spanId` в каждой строке лога автоматически
- gRPC `traceparent` header propagation между сервисами автоматически
- HTTP auto-instrumentation на gateway
- Нет необходимости в Jaeger/Tempo на старте — trace ID в логах достаточно для корреляции

**Bootstrap (загружается ДО NestJS):**

```typescript
// packages/foundation/src/tracing/tracing.ts

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  serviceName: process.env.SERVICE_NAME,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
    }),
  ],
  // Нет экспортёра = trace context только in-process для propagation
  // Jaeger/Tempo добавляется позже одной строкой конфига
});

sdk.start();
```

```typescript
// apps/sender/src/main.ts
import '@email-platform/foundation/tracing';  // ПЕРВАЯ строка
import { NestFactory } from '@nestjs/core';
```

### 7.2. Pino интеграция — trace ID в логах

**Mixin в LoggingModule (заменяет custom correlation ID):**

```typescript
import { trace, context } from '@opentelemetry/api';

const mixin = () => {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const { traceId, spanId } = span.spanContext();
  return { traceId, spanId };
};
```

**Результат — каждая строка лога:**

```json
{
  "level": "info",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "service": "sender",
  "method": "CreateCampaign",
  "duration": 142,
  "msg": "gRPC call completed"
}
```

**Фильтрация:** `grep "4bf92f3577b34da6" *.log` → весь путь запроса через все сервисы.

### 7.3. Уровни логирования ошибок

```
ERROR  — Неожиданные сбои: инфраструктурные ошибки, data corruption, unhandled exceptions
         Сюда попадают: connection lost, disk full, schema drift, reconstitution failure

WARN   — Ожидаемые ошибки: бизнес-отказы, валидация, auth failures
         Сюда попадают: invalid input, not found, unauthorized, rate limit, duplicate

INFO   — Успешные операции
         Сюда попадают: request completed, campaign created, email sent

DEBUG  — Детали для отладки
         Сюда попадают: запрос/ответ gRPC, SQL queries, cache hits/misses
```

**Правило:** Если ошибка требует вмешательства инженера → ERROR. Если ожидаема и обработана → WARN.

### 7.4. Sensitive data filtering

```typescript
// В AllRpcExceptionsFilter — перед логированием
function sanitize(error: unknown): Record<string, unknown> {
  const str = JSON.stringify(error);
  return JSON.parse(
    str.replace(/mongodb(\+srv)?:\/\/[^"'\s]+/gi, '[REDACTED_MONGO_URL]')
       .replace(/password['":\s]*['"][^'"]+['"]/gi, 'password: "[REDACTED]"')
       .replace(/bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
  );
}
```

### 7.5. Логирование: dev vs production

```
Dev (terminal):   LOG_FORMAT=pretty → pino-pretty с цветами и отступами
                  traceId в логе, но не критичен — один сервис в одном терминале

Production:       LOG_FORMAT=json → структурированный JSON в stdout
                  Docker/K8s ловит stdout → Loki/ELK/CloudWatch
                  traceId для кросс-сервисного поиска
                  Jaeger/Tempo (фаза 2) для визуальных waterfall-диаграмм
```

**Никаких fs.writeFile для логов.** Приложение пишет в stdout (12-Factor, Factor XI). Платформа роутит.

### 7.6. Путь миграции трассировки

**Фаза 1 (сейчас):** OTEL SDK + auto-instrumentation + Pino mixin. Trace ID в логах. Grep для корреляции. Нет внешней инфраструктуры.

**Фаза 2 (позже):** Добавить `@opentelemetry/exporter-trace-otlp-http` + Jaeger/Tempo. Визуальные waterfall-графики. Ноль изменений в коде — только конфиг экспортёра.

**Фаза 3 (по необходимости):** Custom spans в use cases через `tracer.startActiveSpan()`. Гранулярная видимость бизнес-логики.

---

## 8. Что происходит с текущим кодом

| Текущий компонент | Решение | Действие |
|---|---|---|
| `GrpcException` hierarchy | Остаётся | Используется на transport boundary |
| `AllRpcExceptionsFilter` | Остаётся | Catch-all для непойманных exceptions |
| `GrpcToHttpExceptionFilter` | Остаётся | gRPC→HTTP маппинг (уже работает) |
| `error-messages.ts` constants | Заменяется | `DomainErrors` / `AppErrors` фабрики |
| `x-correlation-id` propagation | Заменяется | OTEL `traceparent` (автоматический) |
| `GrpcCorrelationInterceptor` | Упрощается | CLS остаётся для userId, но correlation = traceId |
| `GrpcLoggingInterceptor` | Остаётся | Логи обогащаются traceId через mixin |
| `createGrpcMetadata()` helper | Упрощается | OTEL инжектит traceparent автоматически |
| Use case `throw new Error()` | Заменяется | `return err(...)` / `ResultAsync` |
| Repository `throw NotImplementedException` | Заменяется | Реальные реализации с error translation |

---

## 9. Сводка решений

| Вопрос из ERROR-LANDSCAPE | Решение |
|---|---|
| Exceptions vs Result? | Result внутри, exceptions на границе |
| Библиотека? | `neverthrow` (ResultAsync, 1.6M downloads/week) |
| Domain validation? | Specification → Invariant → VO.create() с аккумуляцией |
| Аккумуляция ошибок? | `combineWithAllErrors` для независимых проверок |
| Use case модель? | Фазы: validate (accumulate) → check (accumulate) → commit (fail-fast) |
| Domain errors: классы или объекты? | Plain objects с discriminated union (DomainErrorCode) |
| Кто маппит domain→gRPC? | gRPC controller через `toGrpcException()` Record dispatch |
| Кто маппит MongoError→domain? | Repository адаптер (catch + translate) |
| Batch partial failure? | `BatchResult<T, E>` с succeeded/failed массивами |
| Retry classification? | По error code: EXTERNAL_SERVICE_FAILED / OPERATION_TIMEOUT = retryable |
| Трассировка? | OpenTelemetry (3 пакета, auto-instrument gRPC + HTTP) |
| Correlation ID? | OTEL traceId через Pino mixin (заменяет custom x-correlation-id) |
| Логирование dev/prod? | pino-pretty / JSON stdout. Никаких файлов (12-Factor) |
| Sensitive data? | Sanitize filter перед логированием (regex redaction) |
| Cascade timeout? | Deadline propagation с budget вычитанием |
| RabbitMQ failures? | Retry 3x → dead letter queue + idempotency через event_id |
| Optimistic locking? | Version в агрегате, CAS в repository |
| Reconstitution failure? | Repository логирует ERROR, use case получает generic failure |
