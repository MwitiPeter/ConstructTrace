import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

const supabase =
  env.supabaseUrl && env.supabaseServiceRoleKey
    ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export const usesSupabaseStorage = Boolean(supabase);
export const isSupabaseObject = (objectName) =>
  usesSupabaseStorage && String(objectName || '').startsWith('papers/');

function assertSupabase() {
  if (!supabase) throw new Error('Supabase Storage is not configured.');
  return supabase;
}

export async function uploadPdf(objectName, buffer) {
  if (!supabase) return;
  const { error } = await assertSupabase().storage.from(env.supabaseStorageBucket).upload(objectName, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (error) {
    const hint =
      /row-level security policy/i.test(error.message)
        ? ' Use the Supabase service_role key in SUPABASE_SERVICE_ROLE_KEY, or add a Storage INSERT policy for this bucket.'
        : '';
    throw new Error(`Supabase upload failed: ${error.message}.${hint}`);
  }
}

export async function downloadPdf(objectName) {
  const { data, error } = await assertSupabase().storage.from(env.supabaseStorageBucket).download(objectName);
  if (error) throw new Error(`Supabase download failed: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function removeStoredObject(objectName) {
  if (!supabase || !objectName) return;
  const { error } = await assertSupabase().storage.from(env.supabaseStorageBucket).remove([objectName]);
  if (error) throw new Error(`Supabase deletion failed: ${error.message}`);
}

export async function removeLocalFile(storedName) {
  if (!storedName) return;
  try {
    await fs.promises.unlink(path.join(env.uploadsDir, path.basename(storedName)));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
