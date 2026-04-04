# Архитектура Платформы Email-Рассылок
> Презентация инфраструктуры и взаимодействия микросервисов

---

## 1. Введение и Общая концепция

Платформа представляет собой высоконагруженную систему для парсинга контактов и массовых email-рассылок.
Для обеспечения масштабируемости, отказоустойчивости и независимости команд разработки выбрана **Микросервисная архитектура**.

**Ключевые технологии:**
- **Кодовая база:** Monorepo (Turborepo), TypeScript
- **Фреймворк:** NestJS (Node.js)
- **Точка входа:** API Gateway (REST HTTP)
- **Внутренний транспорт:** gRPC (синхронно) и RabbitMQ (асинхронно/события)
- **Базы данных и хранилища:** PostgreSQL (с Drizzle ORM), Redis, MinIO (S3)

---

## 2. Предпосылки к переходу (Проблемы монолита)

Предыдущая LTS-архитектура была представлена монолитом, что несло архитектурные риски:
- **Отсутствие SRP:** Код разных доменов (рассылки, парсинг) был перемешан, зоны ответственности размыты.
- **Отсутствие изоляции (Tight Coupling):** Прямые вызовы между модулями позволяли изменениям в одной части неявно ломать логику другой.
- **Единая база данных:** Все модули делили одну СУБД (риск каскадных блокировок).
- **Смешение ресурсов:** Тяжелые фоновые задачи (парсинг) находились в одном Event Loop с REST API, что создавало риски просадки ответов пользователям.
- **Хрупкие интеграции:** Синхронные вызовы внешних API блокировали процессы при нестабильности от сторонних серверов.

---

## 3. Высокоуровневая схема инфраструктуры

Точкой входа в систему является **API Gateway**, который принимает HTTP-запросы от клиентов и проксирует их внутренним сервисам. Nginx упразднен в угоду упрощения маршрутизации.

```mermaid
graph TB
    Client["Клиент<br/>(SPA / API)"]

    subgraph "Edge Layer"
        GW["API Gateway<br/>(REST HTTP :3000)"]
    end

    subgraph "Domain Services (gRPC)"
        AUTH["Auth Service<br/>(Управление доступом)"]
        SENDER["Sender Service<br/>(Ядро рассылок)"]
        PARSER["Parser Service<br/>(Сбор данных)"]
        AUD["Audience Service<br/>(Управление контактами)"]
    end

    subgraph "Background Services"
        NOTIF["Notifier Service<br/>(Алерты и уведомления)"]
    end

    subgraph "Infrastructure"
        PG[(PostgreSQL)]
        REDIS[(Redis)]
        RMQ[("RabbitMQ")]
        S3["MinIO / S3<br/>(Файлы, CSV)"]
    end

    subgraph "External API"
        TG["Telegram Bot API"]
        APPSPY["AppStoreSpy API"]
        PROXY["Google Cloud<br/>Proxy Functions"]
    end

    Client -->|"HTTP request"| GW

    GW -->|gRPC| AUTH
    GW -->|gRPC| SENDER
    GW -->|gRPC| PARSER
    GW -->|gRPC| AUD

    SENDER <-->|gRPC| AUD

    SENDER -->|publish events| RMQ
    PARSER -->|publish events| RMQ
    RMQ -->|subscribe| NOTIF

    AUTH --> PG
    SENDER --> PG
    SENDER --> REDIS
    PARSER --> PG
    AUD --> PG

    PARSER --> APPSPY
    PARSER --> S3
    SENDER --> PROXY
    NOTIF --> TG
    NOTIF --> S3
```

---

## 4. Взаимодействие сервисов

В системе используется два основных паттерна взаимодействия, что позволяет балансировать между скоростью ответа клиенту и надежностью фоновых процессов.

### 4.1. Синхронное взаимодействие (gRPC)
Используется там, где клиенту или другому сервису ответ нужен немедленно. Отличается высокой скоростью благодаря протоколу HTTP/2 и бинарной сериализации Protobuf.
- Gateway ➔ Auth: `ValidateToken()` для верификации доступа к защищенным маршрутам.
- Gateway ➔ Sender: `CreateCampaign()` для создания рассылки пользователем.
- Sender ➔ Audience: `GetRecipientsByGroup()` для получения контактов перед началом отправки писем.

### 4.2. Асинхронное взаимодействие (RabbitMQ)
Используется для уведомлений, передачи данных и фоновых процессов (Fire-and-Forget, Data Transfer). Позволяет снять нагрузку с синхронного канала.
- Sender ➔ `campaign.completed` (Event) ➔ Notifier (Отправка отчета в Telegram).
- Parser ➔ `parsing.batch.ready` (Event) ➔ Audience (Асинхронный импорт новых спарсенных контактов в базу Audience).

```mermaid
graph LR
    subgraph "Синхронно (gRPC) - Низкая задержка"
        G1["Gateway"] -- "Auth.ValidateToken()" --> A1["Auth"]
        S1["Sender"] -- "Audience.GetRecipients()" --> AU1["Audience"]
    end

    subgraph "Асинхронно (RabbitMQ) - Высокая надежность"
        P2["Parser"] -- "'parsing.batch.ready'" --> MQ(("RabbitMQ"))
        MQ -- "consume pipeline" --> AU2["Audience"]
        
        S2["Sender"] -- "'campaign.completed'" --> MQ2(("RabbitMQ"))
        MQ2 -- "consume alerts" --> N2["Notifier"]
    end
```

---

## 5. Архитектура данных

Каждый микросервис **полностью контролирует и владеет своими данными**. Прямой доступ одних сервисов к базам данных других сервисов категорически запрещен (базы логически разделены).

| Тип БД / Хранилища | Сервис | Назначение (Таблицы, pgSchema per service) |
| :--- | :--- | :--- |
| **PostgreSQL** | **Auth** | Пользователи (`users`), сессии/токены (`refresh_tokens`) — pgSchema `auth` |
| **PostgreSQL** | **Sender** | Кампании (`campaigns`), Воркеры (`runners`), Письма (`messages`), Макросы (`macros`) — pgSchema `sender` |
| **PostgreSQL** | **Parser** | Настройки парсинга (`parser_tasks`, `parser_settings`), Использованные параметры — pgSchema `parser` |
| **PostgreSQL** | **Audience**| Адресаты (`recipients`), Группы рассылки (`recipient_groups`) — pgSchema `audience` |
| **Redis** | **Sender** | Кэширование, BullMQ (очереди воркеров для рассылки) |
| **RabbitMQ** | **Все** | Exchange для топиков событий (`events`), Очереди консьюмеров |
| **MinIO (S3)** | **Parser / Notifier**| Экспорт CSV, логи, хранение объемных результатов между сервисами |

---

## 6. Бизнес-потоки (Data Flows)

Рассмотрим несколько ключевых сценариев взаимодействия от конца до конца.

### 6.1 Токен и Аутентификация
Любой защищенный запрос валидируется через Auth сервис перед тем, как Gateway проксирует его целевому сервису.

```mermaid
sequenceDiagram
    participant C as Клиент
    participant G as Gateway
    participant A as Auth Service
    participant S as Sender Service

    C->>G: GET /sender/campaigns (Bearer Токен)
    G->>A: gRPC ValidateToken(Token)
    A-->>G: UserContext {userId, role}
    
    Note over G,S: Gateway извлекает контекст
    G->>S: gRPC ListCampaigns(UserContext обогащен)
    S-->>G: campaigns[]
    G-->>C: 200 OK (JSON)
```

### 6.2 Жизненный цикл рассылки
Демонстрирует работу Sender сервиса совместно с Audience (получение адресатов) и внешними прокси сервисами.

```mermaid
sequenceDiagram
    participant G as Gateway
    participant S as Sender
    participant A as Audience
    participant P as HTTP Proxy (GCF)
    participant MQ as RabbitMQ
    participant N as Notifier

    G->>S: gRPC CreateCampaign()
    S->>S: Сохранение кампании (PostgreSQL)
    
    Note over S: Запуск воркера
    S->>A: gRPC GetRecipientsByGroup(groupId)
    A-->>S: recipients[]
    
    loop Для каждого получателя
        S->>P: POST Email через proxy
        P-->>S: OK / Error
        S->>A: gRPC MarkAsSent()
    end
    
    S->>MQ: Публикация события "campaign.completed"
    MQ->>N: Consumer принимает событие
    N->>N: Отправка отчета в Telegram
```

### 6.3 Сбор аудитории (Парсинг)
Иллюстрирует асинхронную передачу тяжелых объемов данных через событие, совмещенное со ссылкой на S3 хранилище (Claim Check Pattern).

```mermaid
sequenceDiagram
    participant P as Parser
    participant API as AppStoreSpy API
    participant S3 as MinIO (S3)
    participant MQ as RabbitMQ
    participant A as Audience

    Note over P: Срабатывает CRON
    P->>API: HTTP GET /apps
    API-->>P: Данные приложений с email
    
    P->>S3: Выгрузка полного CSV-отчета
    S3-->>P: Object URL
    
    P->>MQ: Событие "parsing.batch.ready" (с ссылкой URL)
    MQ->>A: Consumer принимает событие
    A->>S3: Загрузка результатов
    A->>A: Дедупликация и сохранение в PostgreSQL (recipients)
```

---

## 7. Как микросервисы решили проблемы

Новая архитектура вводит строгие контракты и физическое разделение:
1. **Строгие границы (SRP):** Сервисы (Sender, Parser) полностью независимы. Они общаются исключительно через утвержденные gRPC-контракты.
2. **Изоляция данных (Database per Service):** Каждый сервис владеет только своей БД, что навсегда исключает пересечение логики таблиц.
3. **Изоляция ресурсов:** Ресурсоемкие сервисы выведены в отдельные контейнеры и не конкурируют за процессорное время с Gateway (REST API).
4. **Асинхронность и очереди:** RabbitMQ забирает на себя тяжелые и нестабильные фоновые интеграции (алерты), гарантируя доставку и не блокируя основной поток кода микросервисов.

---

## 8. Внутренняя архитектура сервисов (Clean / Hexagonal)

Внутри каждого сервиса изолированно и строго соблюдается **Hexagonal Architecture (Ports and Adapters)**, разделяющая бизнес-логику от транспортного и инфраструктурного слоя.

```mermaid
graph TB
    subgraph "Infrastructure Layer (Фреймворки, БД)"
        REST["REST Controller (Gateway)"]
        GRPC_IN["gRPC Server (Inbound Adapter)"]
        GRPC_OUT["gRPC Client (Outbound Adapter)"]
        RABBIT["RabbitMQ Pub/Sub"]
        PG_REPO["PostgreSQL Repositories (Drizzle)"]
    end

    subgraph "Application Layer (Оркестрация Use Cases)"
        UC["Use Cases (Сценарии использования)"]
        IP["Inbound Ports (Интерфейсы входа)"]
        OP["Outbound Ports (Интерфейсы выхода)"]
    end

    subgraph "Domain Layer (Бизнес-ядро)"
        ENT["Entities (Сущности)"]
        VO["Value Objects"]
        DS["Domain Services"]
    end

    GRPC_IN -.implements.-> IP
    REST -.implements.-> IP

    IP --> UC
    UC --> OP
    UC --> ENT
    UC --> DS

    GRPC_OUT -.implements.-> OP
    RABBIT -.implements.-> OP
    PG_REPO -.implements.-> OP

    style ENT fill:#2d5a27,stroke:#4caf50
    style DS fill:#2d5a27,stroke:#4caf50
    style UC fill:#1a3a5c,stroke:#2196f3
    style IP fill:#1a3a5c,stroke:#2196f3
    style OP fill:#1a3a5c,stroke:#2196f3
```

**Ключевые принципы реализации кода микросервисов:**
1. **Dependency Inversion (Инверсия зависимостей):** Бизнес-логика (Domain/Application) не знает о существовании баз данных (PostgreSQL), транспортов (gRPC/RabbitMQ) или веб-фреймворка (NestJS). Она зависит исключительно от абстракций (Ports).
2. **Изоляция и Тестируемость:** Замена источника данных или добавление нового интерфейса (CLI) требует лишь написания нового адаптера (Adapter). Код бизнес-сценариев и бизнес-сущностей не затрагивается.
3. **Чистые доменные объекты:** Сущности в слое Domain состоят исключительно из чистых TypeScript-классов со свойствами и поведением предметной области. Использование ORM декораторов в домене недопустимо.
