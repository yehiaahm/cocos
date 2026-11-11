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
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? 'GET',
      credentials: 'same-origin',
      headers: { accept: 'application/json', ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'تعذّر الاتصال بالسيرفر — تأكد من الإنترنت');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (res.status === 401 && !path.endsWith('/login')) window.dispatchEvent(new Event('admin:unauthorized'));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'حدث خطأ، حاول مرة أخرى', data.code);
  return data;
}
