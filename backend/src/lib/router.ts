import { RequestHandler, Router } from 'express';

// Express 4 does not catch errors thrown from async route handlers: a rejected
// promise (e.g. a transient "Can't reach database server" from the Railway
// proxy) becomes an unhandled rejection, which by default CRASHES the whole
// server process. That is why a momentary database blip would take the backend
// down until a manual restart.
//
// `makeRouter()` returns a normal Express Router whose verb methods auto-wrap
// every handler so a rejected promise is forwarded to Express's error
// middleware (see the handler in index.ts) instead. New routes get this for
// free — there is nothing to remember per-handler.
function wrap(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all'] as const;

export function makeRouter(): Router {
  const router = Router();
  const mutable = router as unknown as Record<string, (...args: unknown[]) => unknown>;
  for (const method of METHODS) {
    const original = mutable[method].bind(router);
    mutable[method] = (path: unknown, ...handlers: unknown[]) =>
      original(path, ...handlers.map((h) => (typeof h === 'function' ? wrap(h as RequestHandler) : h)));
  }
  return router;
}
