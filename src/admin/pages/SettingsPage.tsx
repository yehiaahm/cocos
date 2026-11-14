import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { useSession } from '../AdminApp';
import type { PaymentSettings } from '../../lib/api-types';
import { Button, Card, ErrorBox, Icon, PageHeader, Skeleton, inputCls } from '../ui';
import { disablePush, enablePush, pushState, type PushState } from '../push';

/** Phone notifications: enable / test / disable. Also shown on the dashboard until enabled. */
export function PushCard({ compact = false }: { compact?: boolean }) {
  const { vapidPublicKey } = useSession();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    pushState().then(setState, () => setState('unsupported'));
  }, []);

  if (state === null || (compact && state === 'on')) return null;

  const run = async (fn: () => Promise<PushState>) => {
    setBusy(true);
    setMsg('');
    try {
      setState(await fn());
    } catch (e) {
      setMsg((e as Error).message || 'حدث خطأ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={compact ? 'border-[#D4AF5A]/50 bg-[#FFFBF0]' : ''}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-ink text-gold-light">{Icon.bell(22)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[15px] font-bold">إشعارات الطلبات على الموبايل</h2>
          <p className="mb-0 mt-1 text-sm leading-relaxed text-muted-2">
            {state === 'on'
              ? 'مفعّلة على الجهاز ده ✓ — هيوصلك إشعار مع كل طلب جديد أو إيصال تحويل.'
              : state === 'needs-install'
                ? 'على الآيفون: اضغط زر المشاركة في Safari ← "إضافة إلى الشاشة الرئيسية"، وافتح لوحة التحكم من الأيقونة الجديدة، وبعدها فعّل الإشعارات من هنا.'
                : state === 'denied'
                  ? 'الإشعارات مقفولة من إعدادات المتصفح. افتح إعدادات الموقع في المتصفح واسمح بالإشعارات، وبعدين ارجع هنا.'
                  : state === 'unsupported'
                    ? 'المتصفح ده مش بيدعم الإشعارات. جرّب Chrome على أندرويد أو Safari على آيفون (بعد إضافة اللوحة للشاشة الرئيسية).'
                    : !vapidPublicKey
                      ? 'الإشعارات محتاجة مفاتيح VAPID على السيرفر — شوف README.'
                      : 'فعّلها عشان يوصلك إشعار زي رسايل الواتساب كل ما عميل يطلب من الموقع.'}
          </p>
          {msg && <p className="mb-0 mt-2 text-sm font-semibold text-[#9B1C1C]">{msg}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {state === 'off' && vapidPublicKey && (
              <Button variant="dark" disabled={busy} onClick={() => void run(() => enablePush(vapidPublicKey))}>
                {busy ? 'جارٍ التفعيل…' : 'تفعيل الإشعارات'}
              </Button>
            )}
            {state === 'on' && (
              <>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await api<{ sent: number }>('/api/admin/push', { method: 'PUT' });
                      setMsg(r.sent ? '' : 'مفيش أجهزة اتبعتلها — جرّب تقفل وتفعّل تاني');
                      return 'on';
                    })
                  }
                >
                  إرسال إشعار تجريبي
                </Button>
                <Button variant="danger" disabled={busy} onClick={() => void run(disablePush)}>
                  إيقاف على الجهاز ده
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
      <PageHeader title="الإعدادات" />
      <div className="grid items-start gap-4 min-[1000px]:grid-cols-[1.3fr_1fr]">
        <Card title="الدفع والتوصيل">
          {!s ? (
            error ? <ErrorBox message={error} /> : <Skeleton className="h-64" />
          ) : (
            <form onSubmit={save} className="grid gap-4">
              {field('instapay', 'عنوان إنستاباي', 'اللي العميل هيحوّل عليه (مثلاً name@instapay أو رقم). سيبه فاضي لو مش عايز إنستاباي.', { dir: 'ltr', placeholder: 'name@instapay' })}
              <div className="grid gap-4 sm:grid-cols-2">
                {field('wallet', 'رقم المحفظة', 'سيبه فاضي لو مش عايز دفع بالمحفظة.', { dir: 'ltr', placeholder: '010…' })}
                {field('walletName', 'نوع المحفظة', 'بيظهر للعميل، مثلاً Vodafone Cash.', { dir: 'ltr' })}
              </div>
              {field('deliveryFee', 'مصاريف التوصيل الافتراضية (ج.م)', 'بتتحط تلقائياً على كل طلب جديد، وتقدر تغيّرها لكل طلب.', { type: 'number', dir: 'ltr' })}
              {field('deliveryNote', 'ملاحظة التوصيل', 'بتظهر للعميل في صفحة الدفع (بالإنجليزي).', { dir: 'ltr', placeholder: 'Delivery in 3–5 days across Egypt' })}
              {error && <ErrorBox message={error} />}
              <div className="flex items-center gap-3">
                <Button type="submit" variant="dark" disabled={busy}>
                  {busy ? 'جارٍ الحفظ…' : 'حفظ'}
                </Button>
                {saved && <span className="text-sm font-bold text-[#1E6B3A]">تم الحفظ ✓</span>}
              </div>
            </form>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <PushCard />
          <Card title="الحساب">
            <p className="mb-3 mt-0 text-sm leading-relaxed text-muted-2">
              بتدخل من صفحة تسجيل الدخول العادية في الموقع بالإيميل وكلمة المرور. لتغييرهم: غيّر <code dir="ltr">ADMIN_EMAIL</code> أو <code dir="ltr">ADMIN_PASSWORD</code> من إعدادات المشروع (Variables على Railway، أو Secrets على Cloudflare). أي جهاز مسجّل دخول هيخرج تلقائياً. لو حاسس إن حد تاني دخل، استخدم "تسجيل الخروج من كل الأجهزة". الجلسة بتنتهي بعد يوم من عدم الاستخدام أو بعد 7 أيام.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Button variant="danger" onClick={() => void signOut()}>
                {Icon.out(18)} تسجيل الخروج
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await api('/api/admin/login?all=1', { method: 'DELETE' }).catch(() => undefined);
                  window.location.assign('/login');
                }}
              >
                {Icon.out(18)} تسجيل الخروج من كل الأجهزة
              </Button>
            </div>
          </Card>
          <Card title="استخدمها كتطبيق">
            <p className="m-0 text-sm leading-relaxed text-muted-2">
              على الموبايل افتح <strong dir="ltr">/admin</strong> واختار "إضافة إلى الشاشة الرئيسية" — هتفتح زي التطبيق ومن غير شريط المتصفح.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
