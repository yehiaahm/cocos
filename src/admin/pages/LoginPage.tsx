import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import { Button, inputCls } from '../ui';
import { site } from '../../config/site';

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: { password } });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'حدث خطأ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#F4F1EA] px-4 font-ar">
      <form onSubmit={submit} className="w-full max-w-[380px] rounded-[24px] border border-[#E7E1D5] bg-white p-7 shadow-[0_30px_60px_-40px_rgba(11,46,51,.45)]">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink font-script text-[34px] text-gold-light">C</span>
        <h1 className="m-0 text-center text-[22px] font-bold text-ink">لوحة تحكم {site.name}</h1>
        <p className="mb-6 mt-1 text-center text-sm text-muted-2">ادخل كلمة المرور للمتابعة</p>
        <label htmlFor="pw" className="mb-2 block text-sm font-bold">
          كلمة المرور
        </label>
        <div className="relative">
          <input
            id="pw"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputCls} pl-16`}
            dir="ltr"
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? 'pw-err' : undefined}
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute left-2 top-1/2 -translate-y-1/2 border-0 bg-transparent px-2 text-xs font-bold text-teal-dark">
            {show ? 'إخفاء' : 'إظهار'}
          </button>
        </div>
        {error && (
          <p id="pw-err" role="alert" className="mb-0 mt-2 text-sm font-semibold text-[#9B1C1C]">
            {error}
          </p>
        )}
        <Button type="submit" variant="dark" className="mt-5 w-full" disabled={busy || !password}>
          {busy ? 'جارٍ الدخول…' : 'دخول'}
        </Button>
      </form>
    </div>
  );
}
