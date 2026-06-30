import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  const exampleEnvPath = path.resolve(process.cwd(), '.env.example');
  if (fs.existsSync(exampleEnvPath)) {
    dotenv.config({ path: exampleEnvPath });
  }
}

const supabaseUrl = process.env.SUPABASE_URL || '';

const normalizeKey = (key?: string) => {
  if (!key) return '';
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (trimmed.includes('example') || trimmed.includes('replace_with') || trimmed.includes('your_service_role_key')) {
    return '';
  }
  return trimmed;
};

const normalizeServiceRoleKey = (key?: string) => {
  const normalized = normalizeKey(key);
  return normalized.startsWith('sb_service_role_') ? normalized : '';
};

const normalizeSecretKey = (key?: string) => {
  const normalized = normalizeKey(key);
  return normalized.startsWith('sb_secret_') ? normalized : '';
};

const normalizeAnonKey = (key?: string) => {
  const normalized = normalizeKey(key);
  return normalized.startsWith('sb_publishable_') ? normalized : '';
};

const supabaseKey =
  normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
  normalizeSecretKey(process.env.SUPABASE_SECRET_KEY) ||
  normalizeAnonKey(process.env.SUPABASE_ANON_KEY) ||
  normalizeAnonKey(process.env.SUPABASE_PUBLISHABLE_KEY) ||
  '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase backend client created without URL or key. Set SUPABASE_URL and a valid SUPABASE_KEY environment variable.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const isServiceRoleKey = () => Boolean(normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY));

export const checkDbConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase connection error:', err);
    return false;
  }
};
