import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import paperRoutes from './routes/papers.js';
import constructRoutes from './routes/constructs.js';
import analysisRoutes from './routes/analysis.js';
import dashboardRoutes from './routes/dashboard.js';

/** Build the Express app (no DB connection, no listen) — used by index.js and tests. */
export function buildApp() {
  const app = express();

  app.disable('x-powered-by');
  // Render terminates TLS and forwards the client address in X-Forwarded-For.
  // Trust only the first proxy hop so rate limiting receives the real client IP.
  app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api', paperRoutes);
  app.use('/api', constructRoutes);
  app.use('/api', analysisRoutes);
  app.use('/api', dashboardRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
