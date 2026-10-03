import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth, signToken, setAuthCookie, clearAuthCookie } from '../middleware/auth.js';
import { assertEmail, assertLength } from '../middleware/validate.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const name = assertLength(req.body?.name, 'name', 2, 80);
    const email = assertEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (password.length < 8 || password.length > 128) {
      throw new HttpError(400, 'Password must be between 8 and 128 characters.');
    }
    const existing = await User.findOne({ email });
    if (existing) throw new HttpError(409, 'An account with this email already exists.');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    setAuthCookie(res, signToken(user));
    res.status(201).json({ user: user.toSafeJSON() });
  })
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const email = assertEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!password) throw new HttpError(400, 'Password is required.');

    const user = await User.findOne({ email });
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!ok) throw new HttpError(401, 'Invalid email or password.');

    setAuthCookie(res, signToken(user));
    res.json({ user: user.toSafeJSON() });
  })
);

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw new HttpError(401, 'This account no longer exists.');
    res.json({ user: user.toSafeJSON() });
  })
);

export default router;
