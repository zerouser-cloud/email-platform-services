---
name: branching-patterns
description: Replace if/else chains and switch/case with dispatch patterns. Triggers on conditionals, branching, switch, strategy, handler selection, polymorphism, chain of responsibility, dispatch, routing logic. Apply when writing or reviewing code that selects behavior based on type, key, or condition.
---

# Branching Patterns — No if/else Chains, No switch/case

Replace imperative branching with declarative dispatch. Choose the **simplest pattern that fits**.

## Rule

**Prohibited:** `switch/case`, `if/else if/else` chains (3+ branches) for behavior selection.

**Allowed if/else:** Guard clauses, null checks, early returns, boolean flags — these are control flow, not branching logic.

```typescript
// ALLOWED — guard clause
if (!user) throw new UnauthorizedException();

// ALLOWED — early return
if (items.length === 0) return [];

// ALLOWED — boolean
const label = isActive ? 'on' : 'off';

// PROHIBITED — behavior branching
if (type === 'email') { sendEmail(data); }
else if (type === 'sms') { sendSms(data); }
else if (type === 'push') { sendPush(data); }
else { throw new Error('Unknown'); }
```

## Decision Tree — Which Pattern to Use

```
Need to select behavior by condition?
|
+-- Key is a string/enum?
|   +-- All keys known at compile time --> Record<Key, Handler>
|   +-- Keys are open / need fallback  --> Map + default handler
|
+-- Selection depends on complex condition (multiple fields)?
|   +-- Need ONE handler     --> canHandle chain (CoR)
|   +-- Need SEVERAL in order --> Pipeline with priorities
|
+-- Handler is substantial (state, multiple methods, DI deps)?
|   +-- Classes implementing shared interface + registry/factory
|
+-- Simple check (null, guard, early return)?
    +-- if/else is fine — this is NOT branching logic
```

**Priority: pick the simplest that works.** Don't pull in a Pipeline where a Record suffices.

## Pattern 1 — Record<Key, Handler>

**When:** Finite known keys, simple handler functions, no state needed.

```typescript
type Op = 'add' | 'sub' | 'mul';

const handlers: Record<Op, (a: number, b: number) => number> = {
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
};

function calculate(op: Op, a: number, b: number): number {
  return handlers[op](a, b); // type-safe, no missing key possible
}
```

## Pattern 2 — Map + Fallback

**When:** Keys are open-ended or come from external input. Need graceful degradation.

```typescript
const eventHandlers = new Map<string, (payload: unknown) => void>([
  ['click', (p) => console.log('clicked', p)],
  ['hover', (p) => console.log('hovered', p)],
]);

function dispatch(type: string, payload: unknown): void {
  const handler = eventHandlers.get(type);
  if (!handler) throw new Error(`No handler for: ${type}`);
  handler(payload);
}
```

## Pattern 3 — canHandle Chain (Chain of Responsibility)

**When:** Selection depends on complex conditions, not a single key. One handler wins.

```typescript
interface Handler<T, R> {
  canHandle(req: T): boolean;
  handle(req: T): R;
}

const handlers: Handler<Request, string>[] = [
  {
    canHandle: (req) => req.type === 'text' && req.value < 100,
    handle: (req) => `Small text: ${req.value}`,
  },
  {
    canHandle: (req) => req.type === 'image',
    handle: (req) => `Image: ${req.value}`,
  },
];

function process(req: Request): string {
  const handler = handlers.find((h) => h.canHandle(req));
  if (!handler) throw new Error(`No handler for ${req.type}`);
  return handler.handle(req);
}
```

## Pattern 4 — Classes with Shared Interface

**When:** Handlers are substantial — own state, multiple methods, need DI injection.

```typescript
interface Exporter {
  readonly format: string;
  export(doc: Document): string;
}

class PdfExporter implements Exporter {
  readonly format = 'pdf';
  export(doc: Document) { return `PDF: ${doc.title}`; }
}

class HtmlExporter implements Exporter {
  readonly format = 'html';
  export(doc: Document) { return `<h1>${doc.title}</h1>`; }
}

// Registry via Map
const exporters = new Map<string, Exporter>([
  ['pdf', new PdfExporter()],
  ['html', new HtmlExporter()],
]);

function exportDoc(format: string, doc: Document): string {
  const exporter = exporters.get(format);
  if (!exporter) throw new Error(`Unknown format: ${format}`);
  return exporter.export(doc);
}
```

**NestJS DI integration:**

```typescript
// Inject all implementations via token
const EXPORTERS = Symbol('EXPORTERS');

@Module({
  providers: [
    { provide: EXPORTERS, useClass: PdfExporter, multi: true },
    { provide: EXPORTERS, useClass: HtmlExporter, multi: true },
  ],
})
class ExportModule {}

@Injectable()
class ExportService {
  constructor(@Inject(EXPORTERS) private readonly exporters: Exporter[]) {}

  export(format: string, doc: Document): string {
    const exporter = this.exporters.find((e) => e.format === format);
    if (!exporter) throw new Error(`Unknown format: ${format}`);
    return exporter.export(doc);
  }
}
```

## Pattern 5 — Pipeline with Priorities

**When:** Multiple handlers fire in sequence. Middleware, validation chains, processing stages.

```typescript
interface Middleware<T> {
  priority: number;
  canUse(ctx: T): boolean;
  execute(ctx: T, next: () => T): T;
}

function runPipeline<T>(middlewares: Middleware<T>[], ctx: T): T {
  const chain = middlewares
    .filter((m) => m.canUse(ctx))
    .sort((a, b) => a.priority - b.priority);

  function run(i: number): T {
    if (i >= chain.length) return ctx;
    return chain[i].execute(ctx, () => run(i + 1));
  }
  return run(0);
}
```

**Use only when you genuinely need ordered multi-handler execution.** If one handler suffices, use Pattern 3.

## Anti-Patterns

| Prohibited | Replace With |
|---|---|
| `switch (type) { case 'a': ... case 'b': ... }` | Record or Map dispatch |
| `if (type === 'a') ... else if (type === 'b') ...` with 3+ branches | Record, Map, or canHandle chain |
| Nested `if` by type then by subtype | canHandle chain with compound conditions |
| `instanceof` checks in a loop | Shared interface + polymorphic call |
| Adding a new `case` to an existing switch | Add a new entry to the registry/array |

## Choosing Checklist

Before writing a conditional, ask:

1. Am I dispatching by a known key? --> **Record** (Pattern 1)
2. Is the key dynamic or external? --> **Map + fallback** (Pattern 2)
3. Is the condition multi-field? --> **canHandle** (Pattern 3)
4. Does the handler need DI or state? --> **Classes + interface** (Pattern 4)
5. Do multiple handlers fire? --> **Pipeline** (Pattern 5)
6. Is it a guard/null check? --> **if/else is fine**
