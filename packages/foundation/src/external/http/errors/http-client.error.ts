/**
 * HttpClientError — abstract base for the foundation HTTP error hierarchy (D-07).
 *
 * All concrete HTTP errors (HttpError, TimeoutError, NetworkError,
 * CircuitOpenError) extend this base and expose a `kind` discriminator
 * for exhaustive narrowing at call sites:
 *
 *   if (err instanceof HttpClientError) {
 *     switch (err.kind) { ... } // exhaustive via HttpClientErrorKind union
 *   }
 *
 * `context` captures call-site metadata (url / api) without imposing a
 * specific shape on subclasses.
 */

export type HttpClientErrorKind = 'http' | 'timeout' | 'network' | 'circuit-open';

export abstract class HttpClientError extends Error {
  abstract readonly kind: HttpClientErrorKind;
  readonly context: { readonly url?: string; readonly api?: string };

  constructor(
    message: string,
    context: { url?: string; api?: string } = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.context = context;
  }
}
