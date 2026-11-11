import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Seo } from '../lib/seo';
import { authRequest, useAuth } from '../store/auth';
import type { AccountUser } from '../lib/api-types';
import { ArrowRight, GoogleLogo } from '../components/Icons';

type Mode = 'signin' | 'register';
type Errors = Partial<Record<'name' | 'email' | 'password' | 'form', string>>;

const GOOGLE_ERRORS: Record<string, string> = {
  google_off: 'Google sign-in is not available yet. Please use your email and password.',
  google_cancelled: 'Google sign-in was cancelled.',
  google_state: 'Your Google sign-in expired. Please try again.',
  google_unverified: 'Please verify your email address with Google first, or use email and password.',
  google_failed: 'Google sign-in failed. Please try again.',
};

/** Only same-site paths are accepted as the destination after signing in. */
const safeNext = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/api/') ? v : '/account');

const inputCls = (bad?: string) =>
  `min-h-[52px] w-full rounded-2xl border-[1.5px] bg-white px-4 text-base text-ink outline-none placeholder:text-muted-2 focus:border-teal ${
    bad ? 'border-[#B3261E]' : 'border-line-2'
  }`;

export function LoginPage({ initialMode = 'signin' }: { initialMode?: Mode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const googleOn = useAuth((s) => s.google);
  const setUser = useAuth((s) => s.setUser);

  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : initialMode);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<Errors>(() => {
    const code = params.get('error');
    return code ? { form: GOOGLE_ERRORS[code] ?? GOOGLE_ERRORS.google_failed } : {};
  });
  const [busy, setBusy] = useState(false);

  // Already signed in (e.g. back button after login) → go where they were heading.
  useEffect(() => {
    if (status === 'ready' && user) navigate(next, { replace: true });
  }, [status, user, next, navigate]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k] || errors.form) setErrors((x) => ({ ...x, [k]: undefined, form: undefined }));
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setErrors({});
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const errs: Errors = {};
    if (mode === 'register' && form.name.trim().length < 2) errs.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errs.email = 'Please enter a valid email address.';
    if (mode === 'register' ? form.password.length < 8 : !form.password) {
      errs.password = mode === 'register' ? 'Use at least 8 characters for your password.' : 'Please enter your password.';
    }
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      document.getElementById(`auth-${first}`)?.focus();
      return;
    }
    const website = (e.currentTarget.elements.namedItem('website') as HTMLInputElement | null)?.value ?? '';
    setBusy(true);
    try {
      const data = await authRequest<{ user: AccountUser }>(
        mode === 'register' ? '/api/auth/register' : '/api/auth/login',
        mode === 'register' ? { ...form, website } : { email: form.email, password: form.password },
      );
      setUser(data.user);
      navigate(next, { replace: true });
    } catch (err) {
      const { message, code } = err as { message: string; code: string };
      if (code === 'name' || code === 'email' || code === 'password') {
        setErrors({ [code]: message });
        document.getElementById(`auth-${code}`)?.focus();
      } else setErrors({ form: message });
    } finally {
      setBusy(false);
    }
  };

  const isRegister = mode === 'register';
  const googleHref = `/api/auth/google?next=${encodeURIComponent(next)}`;

  return (
    <>
      <Seo title={isRegister ? 'Create an account' : 'Sign in'} path="/login" noindex />
      <section className="container-page grid items-start gap-10 pb-28 pt-4 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="max-[899px]:text-center">
          <p className="eyebrow mb-3">Your account · حسابك</p>
          <h1 className="m-0 font-serif text-[clamp(40px,6vw,76px)] font-medium leading-[.95] tracking-[-.02em]">
            {isRegister ? (
              <>
                Join the <em>studio.</em>
              </>
            ) : (
              <>
                Welcome <em>back.</em>
              </>
            )}
          </h1>
          <p className="mt-4 max-w-[520px] text-[17px] leading-[1.65] text-muted max-[899px]:mx-auto">
            Sign in to check out faster with your saved delivery details and follow every order in one place.
          </p>
        </div>

        <div className="rounded-[28px] bg-white p-8 shadow-[0_26px_56px_-30px_rgba(11,46,51,.35)] max-[560px]:rounded-[22px] max-[560px]:p-5">
          <div role="tablist" aria-label="Sign in or create an account" className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-cream p-1">
            {(['signin', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`min-h-[44px] rounded-full border-0 text-sm font-bold transition-colors ${
                  mode === m ? 'bg-ink text-cream' : 'bg-transparent text-ink hover:text-teal-dark'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {googleOn && (
            <>
              <a
                href={googleHref}
                className="btn inline-flex min-h-[52px] w-full items-center justify-center gap-3 rounded-full border-[1.5px] border-line-2 bg-white text-[15px] font-bold text-ink no-underline hover:border-ink hover:text-ink"
              >
                <GoogleLogo size={20} />
                Continue with Google
              </a>
              <div className="my-6 flex items-center gap-3 text-[13px] font-semibold text-muted-2" aria-hidden="true">
                <span className="h-px flex-1 bg-line" />
                or with email
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}

          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5" aria-label={isRegister ? 'Create an account' : 'Sign in'}>
            {isRegister && (
              <Field id="name" label="Full name" error={errors.name}>
                <input id="auth-name" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'auth-name-err' : undefined} className={inputCls(errors.name)} />
              </Field>
            )}
            <Field id="email" label="Email" error={errors.email}>
              <input id="auth-email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'auth-email-err' : undefined} className={inputCls(errors.email)} />
            </Field>
            <Field id="password" label="Password" error={errors.password} hint={isRegister ? 'At least 8 characters.' : undefined}>
              <input
                id="auth-password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={form.password}
                onChange={set('password')}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'auth-password-err' : isRegister ? 'auth-password-hint' : undefined}
                className={inputCls(errors.password)}
              />
            </Field>
            {/* Honeypot: hidden from people, filled in by bots. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="auth-website">Website</label>
              <input id="auth-website" name="website" tabIndex={-1} autoComplete="off" />
            </div>

            {errors.form && (
              <p role="alert" className="m-0 rounded-2xl bg-[#FBEAEA] px-5 py-4 text-sm font-semibold text-[#7A1F1F]">
                {errors.form}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary inline-flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full border-0 bg-teal-btn text-base font-bold text-white disabled:opacity-60"
            >
              {busy ? (isRegister ? 'Creating your account…' : 'Signing in…') : isRegister ? 'Create account' : 'Sign in'}
              {!busy && <ArrowRight />}
            </button>
          </form>

          <p className="mb-0 mt-5 text-center text-sm text-muted-2">
            {isRegister ? 'Already have an account? ' : 'New here? '}
            <button type="button" onClick={() => switchMode(isRegister ? 'signin' : 'register')} className="border-0 bg-transparent p-0 font-bold text-teal-dark underline">
              {isRegister ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <p className="mb-0 mt-3 text-center text-[13px] text-muted-2">
            No account needed to order — <Link to="/shop" className="font-bold text-teal-dark">keep shopping</Link>.
          </p>
        </div>
      </section>
    </>
  );
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={`auth-${id}`} className="mb-2 block text-sm font-bold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`auth-${id}-err`} className="mb-0 mt-1.5 text-[13px] font-semibold text-[#B3261E]">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`auth-${id}-hint`} className="mb-0 mt-1.5 text-[13px] text-muted-2">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
