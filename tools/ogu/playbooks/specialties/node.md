# Node.js Specialty Addendum

## Runtime Fundamentals
- Node.js is single-threaded for JavaScript execution. CPU-bound work blocks the event loop.
- Use `worker_threads` for CPU-intensive tasks (image processing, crypto, parsing).
- Streams for large data: never load a 500MB file into memory. Use `createReadStream`.
- Error handling: always handle `error` events on streams and EventEmitters.
- Process signals: handle SIGTERM and SIGINT for graceful shutdown.

## Module System
- Use ESM (`import`/`export`) for new projects. CommonJS for compatibility layers.
- Avoid circular imports: they cause subtle bugs with partially initialized modules.
- Use `node:` prefix for built-in modules (`import { readFile } from 'node:fs/promises'`).
- Package.json `"type": "module"` for ESM. `.mjs` extension as fallback.

## API Design (Express/Fastify)
- Middleware order matters: logger → auth → validation → handler → error handler.
- Always validate request bodies with a schema (Zod, Joi, or AJP).
- Return consistent error responses: `{ error: { code, message, details } }`.
- Use async handlers with proper error propagation. Express does not catch async errors by default.
- Set appropriate timeouts: server timeout, keep-alive timeout, database query timeout.

## Database Access
- Use connection pooling. Default pool size: (CPU cores × 2) + 1.
- Parameterized queries always. Never interpolate user input into SQL strings.
- Transactions for multi-step mutations. Rollback on any failure.
- Handle connection errors: reconnect with exponential backoff.
- Close connections and pools on process exit (graceful shutdown).

## Performance
- Cluster mode or PM2 for multi-core utilization.
- `--max-old-space-size` for memory-intensive applications.
- Profile with `node --inspect` and Chrome DevTools. Not console.time.
- Memory leaks: common sources are event listeners, closures, and growing caches.
- Use `AbortController` for cancellable operations (fetch, database queries).

## Security
- Never use `eval()`, `Function()`, or `vm.runInNewContext()` with user input.
- Validate all environment variables at startup, not at first use.
- Rate limit all public endpoints. Use sliding window algorithm.
- Helmet.js for Express security headers. Configure CSP.
- Dependency audit: `npm audit` in CI. Block on critical/high severity.

## Common Pitfalls
- Unhandled promise rejections: add global handler and exit on unhandled rejection.
- Event listener leaks: remove listeners when they are no longer needed.
- Blocking the event loop: `JSON.parse` on large payloads, synchronous file I/O in handlers.
- Trusting `req.ip` without proxy configuration (`trust proxy` setting).

<!-- skills: node, rest-apis, express, database-access, streaming, performance-node, security-node, error-handling -->
