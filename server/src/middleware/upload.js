import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env.js';
import { HttpError } from './error.js';

fs.mkdirSync(env.uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadsDir),
  filename: (_req, file, cb) => {
    const safe = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname || '').toLowerCase() || '.pdf';
    cb(null, `${Date.now()}-${safe}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const ok = file.mimetype === 'application/pdf' || ext === '.pdf';
  if (!ok) return cb(new HttpError(400, 'Only PDF files are allowed.'));
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 },
});

/** Removes a stored upload file, ignoring errors. */
export function removeStoredFile(storedName) {
  if (!storedName) return;
  try {
    fs.unlinkSync(path.join(env.uploadsDir, path.basename(storedName)));
  } catch {
    /* already gone */
  }
}
