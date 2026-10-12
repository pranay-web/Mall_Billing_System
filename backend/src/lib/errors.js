/** An error that maps cleanly onto an HTTP response: `{ error: { code, message, details? } }`. */
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code, message, details) => new HttpError(400, code, message, details);
export const unauthorized = (code, message) => new HttpError(401, code, message);
export const forbidden = (code, message) => new HttpError(403, code, message);
export const notFound = (code, message) => new HttpError(404, code, message);
export const conflict = (code, message, details) => new HttpError(409, code, message, details);
export const unavailable = (code, message) => new HttpError(503, code, message);
export const badGateway = (code, message) => new HttpError(502, code, message);
