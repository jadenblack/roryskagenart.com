import { supabase } from './supabase';

/**
 * Thin fetch wrapper for all admin API calls.
 * - Attaches the Supabase access token as `Authorization: Bearer <jwt>`
 * - Unwraps `{ success, ...payload }` envelopes
 * - Normalizes errors into thrown Error objects
 */
export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  const { method = 'GET', body, signal } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // Session lookup failure should not block public-readable endpoints
  }

  const res = await fetch(path, {
    method,
    headers,
    credentials: 'include',
    signal,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Unexpected non-JSON response (${res.status}) from ${path}`);
  }

  if (!res.ok) {
    const message = data?.error || data?.message || `Request failed (${res.status} ${res.statusText})`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return data as T;
}

/**
 * Multipart upload with the Supabase access token attached. Used for media
 * uploads (the JSON `api()` wrapper cannot carry FormData).
 */
export async function apiUpload<T = any>(
  path: string,
  formData: FormData,
  signal?: AbortSignal
): Promise<T> {
  const headers: Record<string, string> = {};
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // Session lookup failure will surface as a 401 from the server
  }

  const res = await fetch(path, { method: 'POST', headers, credentials: 'include', body: formData, signal });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Unexpected non-JSON response (${res.status}) from ${path}`);
  }

  if (!res.ok) {
    const message = data?.error || data?.message || `Upload failed (${res.status} ${res.statusText})`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return data as T;
}
