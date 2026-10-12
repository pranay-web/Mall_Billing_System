import { verifyToken } from '../lib/auth.js';
import { HttpError, forbidden, unauthorized } from '../lib/errors.js';

/** Compact access log: `POST /api/cart/FC-7KQ2MX/add 200 3.1ms`. */
export const requestLogger = (req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
};

/** Reads a `Bearer` token and attaches the signed-in account (or null) as `req.account`. */
export const authenticate = ({ secret, resolve }) => (req, _res, next) => {
  const header = req.get('authorization') ?? '';
  const payload = header.startsWith('Bearer ') ? verifyToken(header.slice(7), secret) : null;
  req.account = payload ? resolve(payload) : null;
  req.authFailed = Boolean(header) && !req.account;
  next();
};

/** Allows the request only for the given roles (`customer`, `cashier`). */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.account) {
    return next(
      req.authFailed
        ? unauthorized('LOGIN_EXPIRED', 'Your sign-in has expired. Please sign in again.')
        : unauthorized('AUTH_REQUIRED', 'Please sign in to continue.'),
    );
  }
  if (!roles.includes(req.account.role)) {
    return next(forbidden('FORBIDDEN', 'Your account can’t access this.'));
  }
  next();
};

export const apiNotFound = (req, _res, next) =>
  next(new HttpError(404, 'ROUTE_NOT_FOUND', `No API route for ${req.method} ${req.originalUrl}.`));

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
  }
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' } });
};
