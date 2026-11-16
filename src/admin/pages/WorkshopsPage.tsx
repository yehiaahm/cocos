import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { AdminWorkshop, AdminWorkshopInput } from '../../lib/api-types';
import { imageUrl } from '../../lib/images';
import { FALLBACK_WORKSHOP_IMAGE } from '../../lib/workshops';
import { uploadPhoto } from '../upload';
import { Button, Card, Empty, ErrorBox, Icon, PageHeader, Skeleton, Toggle, inputCls } from '../ui';
import { money } from '../format';
import { errorText, startAlign, useT } from '../i18n';

/** What the form edits. The price is kept as text while typing. */
interface Draft {
  name: string;
  nameAr: string;
  tag: string;
  image: string;
  alt: string;
  description: string;
  day1: string;
  day2: string;
  price: string;
  dates: string;
  active: boolean;
}

const emptyDraft: Draft = { name: '', nameAr: '', tag: '', image: '', alt: '', description: '', day1: '', day2: '', price: '', dates: '', active: true };

const draftOf = (w: AdminWorkshop): Draft => ({
  name: w.name,
  nameAr: w.nameAr,
  tag: w.tag,
  image: w.image,
  alt: w.alt,
  description: w.description,
  day1: w.day1,
  day2: w.day2,
  price: w.price === null ? '' : String(w.price),
  dates: w.dates,
  active: w.active,
});

const payloadOf = (d: Draft): AdminWorkshopInput => ({
  name: d.name,
  nameAr: d.nameAr,
  tag: d.tag,
  image: d.image,
  alt: d.alt,
  description: d.description,
  day1: d.day1,
  day2: d.day2,
  price: d.price.trim() === '' ? null : Number(d.price),
  dates: d.dates,
  active: d.active,
});

const label = 'mb-1.5 block text-sm font-bold';
const hint = 'mb-0 mt-1 text-xs text-muted-2';

/** The form used both to add a workshop and to edit one. */
function WorkshopForm({
  draft,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  busy,
  idPrefix,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  busy: boolean;
  idPrefix: string;
}) {
  const t = useT();
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const ltr = { dir: 'ltr' as const, style: { textAlign: startAlign() } };

  const pick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setPhotoError('');
    setUploading(true);
    try {
      set({ image: await uploadPhoto(file) });
    } catch (e) {
      setPhotoError(errorText(e));
    } finally {
      setUploading(false);
    }
  };

  const field = (key: keyof Draft) => `${idPrefix}-${key}`;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!uploading) onSubmit();
      }}
      className="grid gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={field('name')} className={label}>
            {t('ws.name')}
          </label>
          <input id={field('name')} value={draft.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} className={inputCls} {...ltr} />
        </div>
        <div>
          <label htmlFor={field('nameAr')} className={label}>
            {t('ws.nameAr')}
          </label>
          <input id={field('nameAr')} value={draft.nameAr} maxLength={60} onChange={(e) => set({ nameAr: e.target.value })} dir="rtl" lang="ar" className={`${inputCls} font-ar`} style={{ textAlign: 'start' }} />
          <p className={hint}>{t('ws.nameArHint')}</p>
        </div>
      </div>

      <div>
        <label htmlFor={field('description')} className={label}>
          {t('ws.description')}
        </label>
        <textarea id={field('description')} value={draft.description} maxLength={600} rows={3} onChange={(e) => set({ description: e.target.value })} className={`${inputCls} py-2.5`} {...ltr} />
        <p className={hint}>{t('ws.descriptionHint')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={field('day1')} className={label}>
            {t('ws.day1')}
          </label>
          <input id={field('day1')} value={draft.day1} maxLength={200} onChange={(e) => set({ day1: e.target.value })} className={inputCls} {...ltr} />
          <p className={hint}>{t('ws.day1Hint')}</p>
        </div>
        <div>
          <label htmlFor={field('day2')} className={label}>
            {t('ws.day2')}
          </label>
          <input id={field('day2')} value={draft.day2} maxLength={200} onChange={(e) => set({ day2: e.target.value })} className={inputCls} {...ltr} />
          <p className={hint}>{t('ws.day2Hint')}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={field('price')} className={label}>
            {t('ws.price')}
          </label>
          <input id={field('price')} type="number" inputMode="numeric" min={1} value={draft.price} onChange={(e) => set({ price: e.target.value })} dir="ltr" placeholder="—" className={`${inputCls} text-center`} />
          <p className={hint}>{t('ws.priceHint')}</p>
        </div>
        <div>
          <label htmlFor={field('dates')} className={label}>
            {t('ws.dates')}
          </label>
          <input id={field('dates')} value={draft.dates} maxLength={120} onChange={(e) => set({ dates: e.target.value })} className={inputCls} {...ltr} />
          <p className={hint}>{t('ws.datesHint')}</p>
        </div>
        <div>
          <label htmlFor={field('tag')} className={label}>
            {t('ws.tag')}
          </label>
          <input id={field('tag')} value={draft.tag} maxLength={30} onChange={(e) => set({ tag: e.target.value })} className={inputCls} {...ltr} />
          <p className={hint}>{t('ws.tagHint')}</p>
        </div>
      </div>

      <div>
        <p className={label}>{t('ws.photo')}</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative h-24 w-32 flex-none overflow-hidden rounded-xl border border-[#E7E1D5] bg-[#F1EEE7]">
            {draft.image && <img src={imageUrl(draft.image, 320)} alt="" className="h-full w-full object-cover" />}
            {uploading && (
              <span className="skel absolute inset-0 flex items-center justify-center text-[11px] font-bold text-muted-2" aria-busy="true">
                {t('ws.uploading')}
              </span>
            )}
          </div>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#DDD6C8] bg-white px-4 text-sm font-bold text-ink focus-within:border-teal hover:border-ink">
            {Icon.plus(18)} {draft.image ? t('ws.changePhoto') : t('ws.addPhoto')}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                void pick(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {photoError && (
          <p role="alert" className="mb-0 mt-2 text-sm font-bold text-[#9B1C1C]">
            {photoError}
          </p>
        )}
        <p className={hint}>{t('ws.photoHint')}</p>
      </div>

      <div>
        <label htmlFor={field('alt')} className={label}>
          {t('ws.alt')}
        </label>
        <input id={field('alt')} value={draft.alt} maxLength={140} onChange={(e) => set({ alt: e.target.value })} className={inputCls} {...ltr} />
        <p className={hint}>{t('ws.altHint')}</p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl bg-[#F8F5EE] px-4 py-3">
        <div>
          <p className="m-0 text-sm font-bold">{t('ws.visible')}</p>
          <p className={hint}>{t('ws.visibleHint')}</p>
        </div>
        <Toggle checked={draft.active} onChange={(v) => set({ active: v })} label={t('ws.visible')} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="dark" disabled={busy || uploading || draft.name.trim().length < 2}>
          {busy ? t('common.saving') : submitLabel}
        </Button>
        <Button variant="soft" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

export function WorkshopsPage() {
  const t = useT();
  const [list, setList] = useState<AdminWorkshop[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);

  const load = useCallback(async () => {
    setError('');
    try {
      setList((await api<{ workshops: AdminWorkshop[] }>('/api/admin/workshops')).workshops);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  /** Runs one change, then reloads the list and shows a confirmation. */
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(done);
      await load();
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const ok = await run(() => api('/api/admin/workshops', { method: 'POST', body: payloadOf(draft) }), t('ws.created'));
    if (ok) {
      setDraft(emptyDraft);
      setAdding(false);
    }
  };
  const saveEdit = async () => {
    if (!editing) return;
    const ok = await run(() => api(`/api/admin/workshops/${editing}`, { method: 'PATCH', body: payloadOf(editDraft) }), t('ws.saved'));
    if (ok) setEditing(null);
  };
  const toggle = (w: AdminWorkshop, active: boolean) => void run(() => api(`/api/admin/workshops/${w.id}`, { method: 'PATCH', body: { active } }), t('ws.saved'));
  const move = (index: number, by: -1 | 1) => {
    if (!list) return;
    const order = list.map((w) => w.id);
    const j = index + by;
    if (j < 0 || j >= order.length) return;
    [order[index], order[j]] = [order[j], order[index]];
    void run(() => api('/api/admin/workshops', { method: 'PUT', body: { order } }), t('ws.saved'));
  };
  const remove = (w: AdminWorkshop) => {
    setNotice('');
    if (!window.confirm(t('ws.deleteConfirm', { name: w.name }))) return;
    void run(() => api(`/api/admin/workshops/${w.id}`, { method: 'DELETE' }), t('ws.deleted'));
  };

  return (
    <>
      <PageHeader
        title={t('ws.title')}
        sub={list ? t('ws.sub', { n: list.length }) : ' '}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setAdding((v) => !v);
              setEditing(null);
              setNotice('');
            }}
          >
            {Icon.plus(18)} {t('ws.add')}
          </Button>
        }
      />

      {notice && (
        <p role="status" className="mb-3 mt-0 text-sm font-bold text-[#1E6B3A]">
          {notice}
        </p>
      )}
      {error && (
        <div className="mb-3">
          <ErrorBox message={error} onRetry={list ? undefined : () => void load()} />
        </div>
      )}

      {adding && (
        <Card title={t('ws.addTitle')} className="mb-4">
          <WorkshopForm draft={draft} onChange={setDraft} onSubmit={() => void add()} onCancel={() => setAdding(false)} submitLabel={t('ws.add')} busy={busy} idPrefix="new-ws" />
        </Card>
      )}

      {!list ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[96px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty title={t('ws.empty')}>{t('ws.emptyHint')}</Empty>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {list.map((w, i) => (
            <li key={w.id} className={`rounded-[18px] border border-[#E7E1D5] bg-white p-3 ${w.active ? '' : 'bg-white/60'}`}>
              {editing === w.id ? (
                <div className="p-1">
                  <h3 className="mb-4 mt-0 text-[15px] font-bold">{t('ws.editTitle')}</h3>
                  <WorkshopForm draft={editDraft} onChange={setEditDraft} onSubmit={() => void saveEdit()} onCancel={() => setEditing(null)} submitLabel={t('common.save')} busy={busy} idPrefix={`edit-${w.id}`} />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-none flex-col">
                    <button type="button" aria-label={t('ws.moveUp')} title={t('ws.moveUp')} disabled={busy || i === 0} onClick={() => move(i, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-transparent text-ink hover:bg-[#F1EEE7] disabled:opacity-30">
                      {Icon.up(18)}
                    </button>
                    <button type="button" aria-label={t('ws.moveDown')} title={t('ws.moveDown')} disabled={busy || i === list.length - 1} onClick={() => move(i, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-transparent text-ink hover:bg-[#F1EEE7] disabled:opacity-30">
                      {Icon.down(18)}
                    </button>
                  </div>
                  <img src={imageUrl(w.image || FALLBACK_WORKSHOP_IMAGE, 320)} alt="" className={`h-16 w-20 flex-none rounded-xl object-cover ${w.active ? '' : 'opacity-50'}`} loading="lazy" />
                  <div className="min-w-[160px] flex-1">
                    <div className="font-bold" dir="ltr" style={{ textAlign: startAlign() }}>
                      {w.name}
                    </div>
                    {w.nameAr && (
                      <div className="font-ar text-sm text-muted-2" dir="rtl" lang="ar" style={{ textAlign: 'start' }}>
                        {w.nameAr}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-2">
                      <span className={`rounded-full px-2 py-0.5 font-bold ${w.active ? 'bg-[#E3F3E8] text-[#1E6B3A]' : 'bg-[#F1EEE7] text-[#4A5E61]'}`}>{w.active ? t('ws.shown') : t('ws.hidden')}</span>
                      <span className="rounded-full bg-[#F1EEE7] px-2 py-0.5">{w.day2 ? t('ws.twoDays') : t('ws.oneSession')}</span>
                      {w.price !== null && <span className="rounded-full bg-[#F1EEE7] px-2 py-0.5">{money(w.price)}</span>}
                      {w.dates && (
                        <span className="rounded-full bg-[#F1EEE7] px-2 py-0.5" dir="ltr">
                          {w.dates}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Toggle checked={w.active} onChange={(v) => toggle(w, v)} label={t('ws.visible')} />
                    <a href="/#workshops" target="_blank" rel="noopener" className="inline-flex min-h-9 items-center rounded-xl px-3 text-[13px] font-bold">
                      {t('ws.viewOnShop')}
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(w.id);
                        setEditDraft(draftOf(w));
                        setAdding(false);
                        setNotice('');
                      }}
                    >
                      {Icon.edit(16)} {t('ws.edit')}
                    </Button>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => remove(w)}>
                      {Icon.trash(16)} {t('ws.delete')}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {list && list.some((w) => !w.active) && <p className="mb-0 mt-3 text-xs text-muted-2">{t('ws.hiddenNote')}</p>}
    </>
  );
}
