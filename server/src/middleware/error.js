export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Wraps async route handlers so rejections reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function notFoundHandler(req, _res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.path}`));
}

/* eslint-disable no-unused-vars */
export function errorHandler(err, _req, res, _next) {
  // Multer file-size / field errors
  if (err?.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large.' : `Upload failed: ${err.message}`;
    return res.status(400).json({ error: msg });
  }
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ error: `Validation error: ${err.message}` });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid identifier supplied.' });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'A record with that value already exists.' });
  }

  const status = Number.isInteger(err?.status) ? err.status : 500;
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }
  res.status(status).json({
    error: status >= 500 ? 'Something went wrong on the server.' : err.message || 'Request failed.',
  });
}
