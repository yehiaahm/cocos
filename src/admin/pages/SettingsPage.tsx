import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { useSession } from '../AdminApp';
import type { PaymentSettings } from '../../lib/api-types';
import { Button, Card, ErrorBox, Icon, PageHeader, Skeleton, inputCls, rich } from '../ui';
import { setLang, useLang, useT, type Lang } from '../i18n';
import { disablePush, enablePush, pushState, type PushState } from '../push';

/** Phone notifications: enable / test / disable. Also shown on the dashboard until enabled. */
export function PushCard({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { vapidPublicKey } = useSession();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    pushState(vapidPublicKey).then(setState, () => setState('unsupported'));
  }, [vapidPublicKey]);

  if (state === null || (compact && state === 'on')) return null;

  const run = async (fn: () => Promise<PushState>) => {
    setBusy(true);
    setMsg('');
    try {
      setState(await fn());
    } catch (e) {
      setMsg((e as Error).message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={compact ? 'border-[#D4AF5A]/50 bg-[#FFFBF0]' : ''}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-ink text-gold-light">{Icon.bell(22)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[15px] font-bold">{t('push.title')}</h2>
          <p className="mb-0 mt-1 text-sm leading-relaxed text-muted-2">
            {t(
              state === 'on'
                ? 'push.on'
                : state === 'needs-install'
                  ? 'push.needsInstall'
                  : state === 'denied'
                    ? 'push.denied'
                    : state === 'unsupported'
                      ? 'push.unsupported'
                      : !vapidPublicKey
                        ? 'push.noVapid'
                        : 'push.off',
            )}
          </p>
          {msg && <p className="mb-0 mt-2 text-sm font-semibold text-[#9B1C1C]">{msg}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {state === 'off' && vapidPublicKey && (
              <Button variant="dark" disabled={busy} onClick={() => void run(() => enablePush(vapidPublicKey))}>
                {busy ? t('push.enabling') : t('push.enable')}
              </Button>
            )}
            {state === 'on' && (
              <>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await api<{ total: number; sent: number; statuses: number[] }>('/api/admin/push', { method: 'PUT' });
                      if (r.sent) setMsg('');
                      else if (!r.total) setMsg(t('push.noDevices'));
                      else setMsg(t('push.rejected', { codes: [...new Set(r.statuses)].join(', ') || '?' }));
                      return 'on';
                    })
                  }
                >
                  {t('push.test')}
                </Button>
                <Button variant="danger" disabled={busy} onClick={() => void run(disablePush)}>
                  {t('push.disable')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const t = useT();
  const lang = useLang();
  const { signOut } = useSession();
  const [s, setS] = useState<PaymentSettings | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ settings: PaymentSettings }>('/api/admin/settings').then(
      (r) => setS(r.settings),
      (e: Error) => setError(e.message),
    );
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!s) return;
    setBusy(true);
    setError('');
    try {
      setS((await api<{ settings: PaymentSettings }>('/api/admin/settings', { method: 'PUT', body: s })).settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof PaymentSettings, label: string, hint: string, opts: { type?: string; dir?: 'ltr' | 'rtl'; placeholder?: string } = {}) => (
    <div>
      <label htmlFor={`s-${k}`} className="mb-1.5 block text-sm font-bold">
        {label}
      </label>
      <input
        id={`s-${k}`}
        type={opts.type ?? 'text'}
        inputMode={opts.type === 'number' ? 'numeric' : undefined}
        dir={opts.dir}
        placeholder={opts.placeholder}
        value={s?.[k] ?? ''}
        onChange={(e) =>
          setS((x) => x && { ...x, [k]: k === 'deliveryFee' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value })
        }
        className={inputCls}
      />
      <p className="mb-0 mt-1 text-xs text-muted-2">{hint}</p>
    </div>
  );

  return (
    <>
      <PageHeader title={t('set.title')} />
      <div className="grid items-start gap-4 min-[1000px]:grid-cols-[1.3fr_1fr]">
        <Card title={t('set.payCard')}>
          {!s ? (
            error ? <ErrorBox message={error} /> : <Skeleton className="h-64" />
          ) : (
            <form onSubmit={save} className="grid gap-4">
              {field('instapay', t('set.instapay'), t('set.instapayHint'), { dir: 'ltr', placeholder: 'name@instapay' })}
              {field('instapayLink', t('set.instapayLink'), t('set.instapayLinkHint'), { dir: 'ltr', placeholder: 'https://ipn.eg/S/…' })}
              <div className="grid gap-4 sm:grid-cols-2">
                {field('wallet', t('set.wallet'), t('set.walletHint'), { dir: 'ltr', placeholder: '010…' })}
                {field('walletName', t('set.walletName'), t('set.walletNameHint'), { dir: 'ltr' })}
              </div>
              {field('deliveryFee', t('set.fee'), t('set.feeHint'), { type: 'number', dir: 'ltr' })}
              {field('deliveryNote', t('set.note'), t('set.noteHint'), { dir: 'ltr', placeholder: 'Delivery in 3–5 days across Egypt' })}
              {error && <ErrorBox message={error} />}
              <div className="flex items-center gap-3">
                <Button type="submit" variant="dark" disabled={busy}>
                  {busy ? t('common.saving') : t('common.save')}
                </Button>
                {saved && <span className="text-sm font-bold text-[#1E6B3A]">{t('common.saved')}</span>}
              </div>
            </form>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <PushCard />
          <Card title={t('set.language')}>
            <p className="mb-3 mt-0 text-sm leading-relaxed text-muted-2">{t('set.languageHint')}</p>
            <div role="group" aria-label={t('set.language')} className="flex gap-2">
              {(['ar', 'en'] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  lang={l}
                  onClick={() => setLang(l)}
                  className={`min-h-11 flex-1 rounded-xl border px-4 text-sm font-bold ${l === 'ar' ? 'font-ar' : ''} ${
                    lang === l ? 'border-ink bg-ink text-cream' : 'border-[#DDD6C8] bg-white text-ink hover:border-ink'
                  }`}
                >
                  {l === 'ar' ? 'العربية' : 'English'}
                </button>
              ))}
            </div>
          </Card>
          <Card title={t('set.account')}>
            <p className="mb-3 mt-0 text-sm leading-relaxed text-muted-2">{rich(t('set.accountBody'))}</p>
            <div className="flex flex-wrap gap-2.5">
              <Button variant="danger" onClick={() => void signOut()}>
                {Icon.out(18)} {t('app.signOut')}
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await api('/api/admin/login?all=1', { method: 'DELETE' }).catch(() => undefined);
                  window.location.assign('/login');
                }}
              >
                {Icon.out(18)} {t('set.signOutAll')}
              </Button>
            </div>
          </Card>
          <Card title={t('set.app')}>
            <p className="m-0 text-sm leading-relaxed text-muted-2">{rich(t('set.appBody'))}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
