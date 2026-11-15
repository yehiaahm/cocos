import { localizeServerMessage, t } from './i18n';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/** Fetch helper for /api/admin/*. A 401 anywhere sends the dashboard back to the login screen. */
export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  // FormData (photo uploads) goes out as multipart: the browser sets the content type and boundary itself.
  const form = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? 'GET',
      credentials: 'same-origin',
      headers: { accept: 'application/json', ...(opts.body !== undefined && !form ? { 'content-type': 'application/json' } : {}) },
      body: opts.body === undefined ? undefined : form ? (opts.body as FormData) : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, t('api.network'));
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (res.status === 401 && !path.endsWith('/login')) window.dispatchEvent(new Event('admin:unauthorized'));
  if (!res.ok) throw new ApiError(res.status, data.error ? localizeServerMessage(data.error) : t('api.generic'), data.code);
  return data;
}
