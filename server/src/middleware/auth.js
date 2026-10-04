import jwt from 'jsonwebtoken';
import { env, tokenCookieMaxAge } from '../config/env.js';

export const AUTH_COOKIE = 'ct_token';

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email, name: user.name }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: env.isProd ? 'none' : 'lax',
    secure: env.isProd,
    maxAge: tokenCookieMaxAge(),
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: env.isProd ? 'none' : 'lax',
    secure: env.isProd,
    path: '/',
  });
}

/** Reads and verifies the JWT from the http-only cookie (or Authorization header). */
export function requireAuth(req, _res, next) {
  const bearer = req.headers.authorization;
  const token =
    (bearer && bearer.startsWith('Bearer ') ? bearer.slice(7) : null) || req.cookies?.[AUTH_COOKIE];

  if (!token) {
    return next(Object.assign(new Error('Authentication required'), { status: 401 }));
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch {
    const err = new Error('Session expired or invalid. Please sign in again.');
    err.status = 401;
    next(err);
  }
}
