# Error Landscape — DDD + NestJS + gRPC Microservices

Обзорный документ: все типы ошибок, их источники, поток эскалации, edge cases. Без решений — только карта проблемного пространства.

## 1. Слои и их ответственность за ошибки

```
┌─────────────────────────────────────────────────────────────┐
│  HTTP Client (frontend)                                     │
├─────────────────────────────────────────────────────────────┤
│  TRANSPORT: Gateway (REST → gRPC)                           │
│  - Input validation (ValidationPipe)                        │
│  - Authentication (token check)                             │
│  - Rate limiting (Throttler)                                │
│  - gRPC→HTTP error translation                              │
├─────────────────────────────────────────────────────────────┤
│  TRANSPORT: gRPC Server (microservice entry)                │
│  - Proto deserialization                                    │
│  - AllRpcExceptionsFilter (catch-all)                       │
│  - Logging interceptors                                     │
├─────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE: Adapters (inbound)                         │
│  - gRPC controller → use-case mapping                       │
│  - DTO → domain object conversion                           │
│  - Correlation ID propagation                               │
├─────────────────────────────────────────────────────────────┤
│  APPLICATION: Use Cases                                     │
│  - Orchestration, authorization                             │
│  - Port invocation, result composition                      │
│  - Transaction boundaries                                   │
├─────────────────────────────────────────────────────────────┤
│  DOMAIN: Entities, Value Objects, Domain Services           │
│  - Business rule violations                                 │
│  - Invariant enforcement                                    │
│  - Value object validation                                  │
├─────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE: Adapters (outbound)                        │
│  - MongoDB repository implementation                        │
│  - RabbitMQ publisher                                       │
│  - External HTTP APIs                                       │
│  - Redis cache                                              │
│  - MinIO file storage                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Классификация ошибок по происхождению

### 2.1. Domain Errors — нарушения бизнес-правил

Ошибки, которые **имеют смысл для бизнеса**. Домен знает, что пошло не так, и может объяснить это на языке предметной области.

| Источник | Пример | Характер |
|---|---|---|
| Value Object creation | Email с невалидным форматом, пустое имя кампании | Ожидаемые, синхронные |
| Entity invariant | Кампания уже отправлена — нельзя редактировать | Ожидаемые, предсказуемые |
| Aggregate boundary | Добавление дубликата получателя в группу | Ожидаемые |
| Domain Service | Недостаточно получателей для отправки кампании | Ожидаемые, зависят от состояния |
| Factory/reconstitution | Невозможно восстановить entity из повреждённых данных | Неожиданные |

**Ключевые свойства:**
- Не знают про HTTP, gRPC, NestJS — чистый TypeScript
- Не имеют stack trace (это не "сбои", а "бизнес-отказы")
- Несут контекст на языке домена ("кампания в статусе SENT не может быть изменена")
- Могут быть множественными (валидация нескольких полей одновременно)

**Edge cases:**
- **Aggregate cross-validation:** Правило зависит от состояния другого агрегата (например, "группа должна иметь хотя бы 1 получателя перед отправкой"). Домен знает правило, но данные приходят из другого агрегата — кто проверяет?
- **Eventual consistency:** Событие опубликовано, но получатель ещё не обработал его. В момент проверки данные стейл.
- **Reconstitution failure:** Данные в БД повреждены или не соответствуют текущей версии entity. Это доменная ошибка или инфраструктурная?

### 2.2. Application Errors — ошибки оркестрации

Ошибки уровня use case. Приложение не может выполнить запрос, но причина не в бизнес-правиле, а в контексте выполнения.

| Источник | Пример | Характер |
|---|---|---|
| Not found | Запрошенная кампания не существует | Ожидаемые |
| Authorization | Пользователь не имеет права на эту операцию | Ожидаемые |
| Conflict / concurrency | Оптимистичная блокировка: версия entity изменилась | Ожидаемые, ретраируемые |
| Precondition | Use case требует завершения парсинга перед импортом | Ожидаемые |
| Cross-aggregate check | Кампания ссылается на несуществующую группу получателей | Ожидаемые |

**Ключевые свойства:**
- Знают про порты (interfaces), но не про конкретную инфраструктуру
- Могут оборачивать доменные ошибки, добавляя контекст use case
- Определяют "что делать с ошибкой" на уровне бизнес-процесса (retry? compensate? notify?)

**Edge cases:**
- **Partial failure в оркестрации:** Use case вызывает 2 порта: первый успешен, второй упал. Что с первым? Rollback? Compensating action?
- **Timeout как бизнес-решение:** Парсинг внешнего API занимает >30 сек. Это инфраструктурный timeout или бизнес-правило "слишком долго"?
- **Идемпотентность:** Повторный вызов use case с тем же input — это ошибка? Noop? Конфликт?

### 2.3. Infrastructure Errors — сбои внешних систем

Ошибки, о которых домен и application **не должны знать конкретику** — только факт сбоя через абстракцию порта.

| Источник | Пример | Характер |
|---|---|---|
| MongoDB | Connection lost, timeout, duplicate key | Неожиданные, ретраируемые |
| RabbitMQ | Channel closed, publish failed, consumer crash | Неожиданные, ретраируемые |
| Redis | Connection refused, WRONGTYPE | Неожиданные |
| External HTTP API | 5xx, timeout, rate limit, malformed response | Частично ожидаемые |
| MinIO/S3 | Bucket not found, access denied, upload failed | Неожиданные |
| gRPC client (межсервисный) | UNAVAILABLE, DEADLINE_EXCEEDED | Ожидаемые для распределённой системы |
| File system | Disk full, permission denied | Неожиданные |

**Ключевые свойства:**
- Содержат техническую информацию (connection string, SQL error, stack trace)
- Потенциально содержат sensitive data (credentials в connection string)
- Часто transient (повторная попытка может помочь)
- Не должны "протекать" в домен или в HTTP-ответ клиенту

**Edge cases:**
- **MongoDB duplicate key ≠ инфра-ошибка:** Это бизнес-конфликт ("email уже существует"), замаскированный под техническую ошибку. Кто переводит?
- **Connection pool exhaustion:** Все соединения заняты. Ошибка одного запроса или системная деградация?
- **Partial write:** MongoDB записала документ, но RabbitMQ не опубликовал событие. Данные рассинхронизированы.
- **Schema drift:** Приложение обновлено, но миграция БД не выполнена. Поля не совпадают.

### 2.4. Transport Errors — ошибки на границе системы

Ошибки при входе запроса в систему и при отдаче ответа.

| Источник | Пример | Характер |
|---|---|---|
| HTTP validation | Невалидный JSON, отсутствует обязательное поле | Ожидаемые |
| Proto deserialization | Невалидное protobuf-сообщение | Неожиданные |
| Authentication | Невалидный/просроченный JWT | Ожидаемые |
| Rate limiting | Превышен лимит запросов | Ожидаемые |
| CORS | Origin не в whitelist | Ожидаемые |
| Payload size | Запрос превышает max body size | Ожидаемые |
| gRPC metadata | Отсутствует обязательный header | Ожидаемые |

**Edge cases:**
- **Validation на двух уровнях:** DTO валидируется на gateway (class-validator), но proto-сообщение не валидируется на gRPC-сервере. Что если gateway обновили, а сервис нет — proto mismatch?
- **Partial JSON:** Клиент отправил truncated body. Это ошибка парсинга или валидации?
- **Auth + business error:** Токен валиден, но пользователь заблокирован. Это auth ошибка или бизнес?

---

## 3. Поток эскалации ошибок

### 3.1. Восходящий поток (bottom → top)

```
Domain throws "InvalidEmail"
    ↑ Use Case catches? NO — пробрасывает
        ↑ Infrastructure adapter catches? NO — пробрасывает
            ↑ gRPC controller catches? NO — пробрасывает
                ↑ AllRpcExceptionsFilter catches — КОНВЕРТИРУЕТ в gRPC error
                    ↑ gRPC transport sends error response
                        ↑ Gateway gRPC client receives error
                            ↑ GrpcToHttpExceptionFilter — КОНВЕРТИРУЕТ в HTTP error
                                ↑ HTTP response to client
```

**Проблема: в этом потоке есть два "gap":**

1. **Domain → gRPC:** Доменная ошибка (чистый TS) должна стать gRPC-ошибкой с правильным кодом. Кто маппит?
2. **Инфра → Application:** Инфраструктурная ошибка (MongoError) не должна протечь в use case. Кто переводит?

### 3.2. Ответственность за конвертацию на каждом уровне

```
Domain:         Бросает свои ошибки (чистый TS, без фреймворка)
                    ↓
Application:    Может обернуть доменную ошибку, добавив контекст use case
                Может сгенерировать свою (not found, unauthorized)
                    ↓
Infrastructure: ОБЯЗАН перехватить инфра-ошибки (MongoError, AMQPError)
(outbound)      ОБЯЗАН конвертировать в port-контракт (throw domain/app error ИЛИ return Result)
                    ↓
Infrastructure: МОЖЕТ конвертировать domain/app ошибки в gRPC exceptions
(inbound/gRPC)  Или делегирует это exception filter
                    ↓
Transport:      Exception filter делает финальную конвертацию в gRPC/HTTP
```

### 3.3. Межсервисная эскалация

```
Gateway                    Auth Service                 Sender Service
  │                            │                            │
  ├─ HTTP request              │                            │
  ├─ validateToken() ──gRPC──► │                            │
  │                            ├─ ValidateToken use case    │
  │                            ├─ throws Unauthenticated    │
  │  ◄─── gRPC UNAUTHENTICATED ┤                            │
  ├─ maps to HTTP 401          │                            │
  │                            │                            │
  ├─ createCampaign() ─────────────────────────gRPC───────► │
  │                            │                            ├─ calls AudienceService
  │                            │                            │     via gRPC
  │                            │                            ├─ Audience returns NOT_FOUND
  │                            │                            ├─ Sender wraps as FAILED_PRECONDITION
  │  ◄── gRPC FAILED_PRECONDITION ◄────────────────────────┤
  ├─ maps to HTTP 400          │                            │
```

**Edge cases межсервисной эскалации:**
- **Error wrapping chain:** Audience → NOT_FOUND, Sender ловит и пробрасывает — теряется оригинальный контекст. Где группа не найдена — в Sender или Audience?
- **Timeout cascade:** Gateway ждёт Sender, Sender ждёт Audience. Audience тормозит. Кто первый timeout? Sender получает DEADLINE_EXCEEDED от Audience и не может корректно сообщить причину Gateway.
- **Retry amplification:** Gateway ретраит → Sender ретраит → Audience получает 4x нагрузку.

---

## 4. Текущее состояние в email-platform

### 4.1. Что уже реализовано

| Компонент | Статус | Файл |
|---|---|---|
| GrpcException hierarchy (7 типов) | Готов | `foundation/errors/grpc-exceptions.ts` |
| AllRpcExceptionsFilter | Готов | `foundation/errors/rpc-exception.filter.ts` |
| GrpcToHttpExceptionFilter | Готов | `foundation/errors/grpc-to-http.filter.ts` |
| Error message constants | Готов | `foundation/errors/error-messages.ts` |
| gRPC status → HTTP status mapping | Готов | `grpc-to-http.filter.ts` |
| Correlation ID propagation | Готов | `logging/correlation.interceptor.ts` |
| Config validation (Zod) | Готов | `config/config-loader.ts` |
| HTTP ValidationPipe | Готов | `gateway/main.ts` |
| Structured error logging | Готов | `logging/grpc-logging.interceptor.ts` |
| gRPC deadline interceptor | Готов | `resilience/grpc-deadline.interceptor.ts` |

### 4.2. Что отсутствует (gaps)

| Gap | Описание | Влияние |
|---|---|---|
| **Domain exceptions** | Нет бизнес-ошибок в domain layer | Бизнес-правила не могут сообщить о нарушениях типобезопасно |
| **Domain → gRPC mapping** | Нет механизма конвертации доменных ошибок в GrpcException | Доменные ошибки падают как INTERNAL (500) |
| **Infrastructure error translation** | Репозитории не перехватывают MongoError | Технические детали могут протечь наружу |
| **Result type pattern** | Use cases возвращают только success или throw | Нет типобезопасного способа вернуть "бизнес-отказ" без exception |
| **Validation в gRPC** | Нет валидации proto-сообщений на стороне сервиса | Невалидные данные проходят в domain |
| **Batch/aggregate errors** | Нет паттерна для "3 из 10 получателей импортированы" | Partial success невозможен |
| **Retry classification** | Нет разделения retryable / non-retryable | Клиент не знает, стоит ли повторять |
| **Error context enrichment** | Correlation ID есть, но не передаётся в gRPC metadata между сервисами | Трассировка обрывается на границе сервиса |
| **Sensitive data filtering** | Нет фильтрации sensitive данных в error messages | Connection strings могут попасть в лог |
| **Unhandled rejections** | Нет глобального обработчика | Process может умереть без graceful shutdown |
| **RabbitMQ error handling** | Нет паттерна для dead letter, poison message, nack | Сообщения теряются при ошибке обработки |

---

## 5. Сценарии и edge cases

### 5.1. Value Object отвергает данные из базы (Reconstitution)

```
MongoDB хранит { email: "not-an-email" }  (данные повреждены или schema изменилась)
    ↓
Repository.findById() читает документ
    ↓
new Email(doc.email) → бросает "Invalid email format"
    ↓
Это доменная ошибка? Инфра-ошибка? Кто виноват?
```

**Нюанс:** Domain не должен молча принять плохие данные. Но и валидация при чтении из своей же БД — неожиданная ситуация. Это data corruption, не бизнес-отказ.

### 5.2. Duplicate key = бизнес-конфликт через инфраструктуру

```
UseCase: CreateUser(email: "a@b.com")
    ↓
Repository.save(user) → MongoDB throws duplicate key on email index
    ↓
Это MongoError (E11000) — инфраструктурная ошибка
Но смысл — "пользователь с таким email существует" — это бизнес-правило
```

**Нюанс:** Кто переводит? Repository знает про MongoDB, domain знает про правило. Два варианта: (a) repository ловит E11000 и бросает доменную ошибку, (b) use case проверяет уникальность до сохранения (race condition).

### 5.3. Partial failure в batch-операции

```
ImportRecipients(recipients: [r1, r2, r3, r4, r5])
    ↓
r1 OK, r2 OK, r3 DUPLICATE, r4 OK, r5 INVALID_EMAIL
    ↓
Что возвращать? Ошибку? Успех? Partial result?
Что с r1, r2, r4 — они уже сохранены?
```

**Нюанс:** Один throw = все или ничего. Для batch нужна иная модель: результат на каждый элемент + агрегированный статус.

### 5.4. Cascade timeout

```
Gateway ─(timeout 5s)─► Sender ─(timeout 3s)─► Audience
                                                    │
                                                 (takes 4s)
                                                    ↓
                                    Sender gets DEADLINE_EXCEEDED from Audience
                                    Sender has 2s left on its own deadline
                                    What does Sender report to Gateway?
```

**Нюанс:** Sender получил DEADLINE_EXCEEDED от Audience. Sender должен:
- Пробросить как есть? Gateway не знает, что timeout в Audience, а не в Sender
- Обернуть? "Audience timeout while creating campaign" — теперь Gateway знает причину
- А если Sender уже начал работу (сохранил кампанию в свою БД)?

### 5.5. Event handler failure (RabbitMQ)

```
Sender publishes "campaign.completed" → RabbitMQ
    ↓
Notifier consumes message
    ↓
Telegram API returns 429 (rate limit)
    ↓
Что делать с сообщением? Retry? Dead letter? Nack?
А если Notifier крашнулся до ack?
```

**Нюанс:** В отличие от sync gRPC, в async messaging:
- Нет вызывающего, которому можно вернуть ошибку
- Message может быть доставлено повторно (at-least-once)
- Нужна idempotency на стороне consumer
- Нужна стратегия для poison messages (сообщений, которые всегда падают)

### 5.6. Auth token expired mid-request

```
Gateway validates token → OK (token expires in 100ms)
    ↓
Gateway calls Sender → takes 200ms
    ↓
Sender calls Audience, passes user context
    ↓
Audience validates user context → token expired
    ↓
UNAUTHENTICATED or stale context?
```

**Нюанс:** Token проверен на Gateway, но время жизни запроса длиннее времени жизни токена. Downstream сервисы доверяют Gateway или перепроверяют?

### 5.7. Конкурентное обновление (Optimistic Locking)

```
Request A: GET campaign (version: 1) → edit → PUT campaign (version: 1)
Request B: GET campaign (version: 1) → edit → PUT campaign (version: 1)
    ↓
A saves OK → version becomes 2
B saves → version mismatch → CONFLICT
    ↓
Это доменная ошибка? Application? Инфра?
```

**Нюанс:** Версия — часть агрегата (domain concern). Но проверка версии происходит в репозитории при записи. Ошибка возникает в infrastructure, но семантика — domain (optimistic lock conflict).

### 5.8. Многоуровневая валидация

```
HTTP layer:  class-validator проверяет DTO → "email must be string"
gRPC layer:  proto schema гарантирует типы → (нет runtime-валидации)
Domain:      Value Object проверяет бизнес-правила → "email format invalid"
DB:          Unique index проверяет уникальность → "duplicate key"
```

**Нюанс:** 4 уровня валидации с разными ошибками и форматами. Клиент получает разные ответы в зависимости от того, какой уровень первым отказал. Нужна ли нормализация?

### 5.9. Сервис недоступен при health check

```
Gateway /health/ready проверяет Sender через gRPC health
    ↓
Sender работает, но его MongoDB недоступна
    ↓
Sender health: SERVING (gRPC OK) или NOT_SERVING (DB down)?
    ↓
Если NOT_SERVING — Gateway помечает Sender как down
    ↓
Но Sender может обработать запросы, не требующие DB (например, health check самого себя)
```

**Нюанс:** Гранулярность health check: сервис может быть "частично жив".

### 5.10. Error в конструкторе NestJS-провайдера

```
@Injectable()
class SomeService {
  constructor() {
    // throws during DI resolution
    throw new Error('Config invalid');
  }
}
```

**Нюанс:** Ошибка в DI-контейнере крашит весь bootstrap. Нет graceful ответа клиенту — сервис просто не стартует. Config validation (Zod) ловит это раньше, но custom providers могут упасть позже.

---

## 6. Вопросы, требующие решения

Этот список — вход для документа с решениями.

### 6.1. Модель ошибок домена

- Exceptions vs Result type (Either) vs Notification pattern?
- Одна иерархия доменных ошибок или per-aggregate?
- Как агрегировать множественные ошибки валидации?

### 6.2. Поток конвертации

- Кто конвертирует domain error → gRPC error? (Use case? Adapter? Filter?)
- Кто конвертирует MongoError → domain error? (Repository? Отдельный error mapper?)
- Сколько раз ошибка может быть обёрнута в цепочке?

### 6.3. Межсервисная семантика

- Как передать оригинальный error context через gRPC boundary?
- Как различить "мой timeout" от "чужой timeout"?
- Нужна ли стандартная структура error details в proto?

### 6.4. Async / event-driven

- Стратегия retry для RabbitMQ consumers?
- Dead letter queue policy?
- Idempotency pattern для event handlers?
- Как уведомить "вызывающую сторону" об ошибке в async обработке?

### 6.5. Наблюдаемость

- Какие ошибки логировать как error vs warn vs info?
- Как фильтровать sensitive data из error payloads?
- Нужна ли метрика error rate per service/endpoint?
- Как связать ошибку с исходным HTTP-запросом через цепочку gRPC вызовов?

### 6.6. Контракты с клиентом

- Единый формат error response для всех типов ошибок?
- Как сообщить клиенту "можно retry" vs "не повторяйте"?
- Как вернуть partial result в batch-операции?

### 6.7. Граничные решения

- Reconstitution failure: domain error или infrastructure error?
- Duplicate key: проверять в use case или ловить в repository?
- Optimistic locking: domain concern или infrastructure concern?
- Timeout: бизнес-правило или infrastructure limit?
