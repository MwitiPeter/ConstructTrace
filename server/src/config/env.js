import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const isProd = process.env.NODE_ENV === 'production';
const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL);
const hasSupabaseKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-to-a-long-random-string')) {
  // eslint-disable-next-line no-console
  console.warn('[config] WARNING: JWT_SECRET is not set. Set a strong secret before deploying.');
}
if (isProd && hasSupabaseUrl !== hasSupabaseKey) {
  throw new Error('Set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or leave both unset.');
}
if (isProd && !hasSupabaseUrl) {
  // eslint-disable-next-line no-console
  console.warn('[config] WARNING: Supabase Storage is not configured. Render uploads are ephemeral.');
}

export const env = {
  isProd,
  port: num(process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/constructtrace',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 15),
  aiProvider: (process.env.AI_PROVIDER || 'rule').toLowerCase(),
  hfToken: process.env.HF_TOKEN || '',
  hfModel: process.env.HF_MODEL || 'google/gemma-2-2b-it',
  hfApiUrl: process.env.HF_API_URL || 'https://router.huggingface.co/v1/chat/completions',
  hfEmbeddingUrl:
    process.env.HF_EMBEDDING_URL ||
    'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
  uploadsDir: path.resolve(process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads')),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'papers',
};

/** Cookie max-age derived from JWT_EXPIRES_IN (supports Nd / Nh / Nm / plain seconds). */
export function tokenCookieMaxAge() {
  const raw = String(env.jwtExpiresIn);
  const m = raw.match(/^(\d+)([smhd])?$/);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[m[2] || 's'];
  return n * unit * 1000;
}
