import { HttpError } from './error.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Ensures required, non-empty string fields exist on req.body. */
export function requireBody(fields) {
  return (req, _res, next) => {
    const missing = fields.filter((f) => {
      const v = req.body?.[f];
      return v === undefined || v === null || (typeof v === 'string' && !v.trim());
    });
    if (missing.length) {
      return next(new HttpError(400, `Missing required field(s): ${missing.join(', ')}`));
    }
    next();
  };
}

export function assertEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    throw new HttpError(400, 'Please provide a valid email address.');
  }
  return email;
}

export function assertLength(value, field, min, max) {
  const s = String(value || '').trim();
  if (s.length < min || s.length > max) {
    throw new HttpError(400, `"${field}" must be between ${min} and ${max} characters.`);
  }
  return s;
}

export function assertOneOf(value, field, allowed) {
  if (!allowed.includes(value)) {
    throw new HttpError(400, `"${field}" must be one of: ${allowed.join(', ')}.`);
  }
  return value;
}
