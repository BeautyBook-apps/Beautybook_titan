export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function assert(condition, status, code, message) {
  if (!condition) throw new HttpError(status, code, message);
}
export const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const databaseCodes = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '08001', '08006']);
  const databaseErrors = [error, error?.cause, error?.originalError].filter(Boolean);
  const databaseUnavailable = databaseErrors.some(candidate => databaseCodes.has(candidate.code)
    || /getaddrinfo|connect timeout|connection terminated|database system is starting/i.test(candidate.message || ''));
  const status = error instanceof HttpError ? error.status : error.type === 'entity.too.large' ? 413 : databaseUnavailable ? 503 : 500;
  const code = error instanceof HttpError ? error.code : databaseUnavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR';
  const message = error instanceof HttpError
    ? error.message
    : databaseUnavailable
      ? 'La base de données Supabase est momentanément inaccessible. Vérifiez DATABASE_URL puis redémarrez le backend.'
      : 'Le service ne peut pas terminer cette opération.';
  console.error(JSON.stringify({ event: 'request_error', requestId: req.requestId, status, code }));
  res.status(status).json({
    error: message,
    code, request_id: req.requestId,
  });
}
