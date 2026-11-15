import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { AdminCategory } from '../../lib/api-types';
import { CatalogTabs } from '../CatalogTabs';
import { Button, Card, Empty, ErrorBox, Icon, PageHeader, Skeleton, inputCls } from '../ui';
import { categoryLabel, errorText, startAlign, useT } from '../i18n';
import { slugify } from '../../lib/slug';

interface Draft {
  name: string;
  nameAr: string;
  description: string;
  slug: string;
}
const emptyDraft: Draft = { name: '', nameAr: '', description: '', slug: '' };
const label = 'mb-1.5 block text-sm font-bold';
const hint = 'mb-0 mt-1 text-xs text-muted-2';

/** The form used both to add a category and to edit one (the web address can only be chosen when adding). */
function CategoryForm({
  draft,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  busy,
  slugEditable,
  idPrefix,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
  busy: boolean;
  slugEditable: boolean;
  idPrefix: string;
}) {
  const t = useT();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="grid gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-name`} className={label}>
            {t('cats.name')}
          </label>
          <input id={`${idPrefix}-name`} value={draft.name} maxLength={60} onChange={(e) => onChange({ ...draft, name: e.target.value })} dir="ltr" className={inputCls} style={{ textAlign: startAlign() }} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-ar`} className={label}>
            {t('cats.nameAr')}
          </label>
          <input id={`${idPrefix}-ar`} value={draft.nameAr} maxLength={60} onChange={(e) => onChange({ ...draft, nameAr: e.target.value })} dir="rtl" lang="ar" className={`${inputCls} font-ar`} style={{ textAlign: 'start' }} />
          <p className={hint}>{t('cats.nameArHint')}</p>
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-desc`} className={label}>
          {t('cats.description')}
        </label>
        <textarea id={`${idPrefix}-desc`} value={draft.description} maxLength={300} rows={2} onChange={(e) => onChange({ ...draft, description: e.target.value })} dir="ltr" className={`${inputCls} py-2.5`} style={{ textAlign: startAlign() }} />
        <p className={hint}>{t('cats.descriptionHint')}</p>
      </div>
      {slugEditable && (
        <div>
          <label htmlFor={`${idPrefix}-slug`} className={label}>
            {t('cats.slug')}
          </label>
          <input id={`${idPrefix}-slug`} value={draft.slug} maxLength={60} onChange={(e) => onChange({ ...draft, slug: e.target.value.toLowerCase() })} dir="ltr" placeholder={slugify(draft.name)} className={inputCls} style={{ textAlign: startAlign() }} />
          <p className={hint}>{t('cats.slugHint')}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="dark" disabled={busy || draft.name.trim().length < 2}>
          {busy ? t('common.saving') : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="soft" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}

export function CategoriesPage() {
  const t = useT();
  const [list, setList] = useState<AdminCategory[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setList((await api<{ categories: AdminCategory[] }>('/api/admin/categories')).categories);
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
    const ok = await run(() => api('/api/admin/categories', { method: 'POST', body: draft }), t('cats.created'));
    if (ok) {
      setDraft(emptyDraft);
      setAdding(false);
    }
  };
  const saveEdit = async () => {
    if (!editing) return;
    const ok = await run(() => api(`/api/admin/categories/${editing}`, { method: 'PATCH', body: editDraft }), t('cats.saved'));
    if (ok) setEditing(null);
  };
  const move = (index: number, by: -1 | 1) => {
    if (!list) return;
    const order = list.map((c) => c.slug);
    const j = index + by;
    if (j < 0 || j >= order.length) return;
    [order[index], order[j]] = [order[j], order[index]];
    void run(() => api('/api/admin/categories', { method: 'PUT', body: { order } }), t('cats.saved'));
  };
  const remove = async (c: AdminCategory) => {
    const target = (c.count ?? 0) > 0 ? `?moveTo=${encodeURIComponent(moveTo)}` : '';
    const ok = await run(() => api(`/api/admin/categories/${c.slug}${target}`, { method: 'DELETE' }), t('cats.deleted'));
    if (ok) setDeleting(null);
  };
  const startDelete = (c: AdminCategory) => {
    setNotice('');
    if ((c.count ?? 0) === 0) {
      if (window.confirm(t('cats.deleteEmpty', { name: categoryLabel(c) }))) void remove(c);
      return;
    }
    setMoveTo(list?.find((x) => x.slug !== c.slug)?.slug ?? '');
    setDeleting(c.slug);
  };

  return (
    <>
      <CatalogTabs />
      <PageHeader
        title={t('cats.title')}
        sub={list ? t('cats.sub', { n: list.length }) : ' '}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setAdding((v) => !v);
              setNotice('');
            }}
          >
            {Icon.plus(18)} {t('cats.add')}
          </Button>
        }
      />

      {notice && <p role="status" className="mb-3 mt-0 text-sm font-bold text-[#1E6B3A]">{notice}</p>}
      {error && (
        <div className="mb-3">
          <ErrorBox message={error} onRetry={list ? undefined : () => void load()} />
        </div>
      )}

      {adding && (
        <Card title={t('cats.addTitle')} className="mb-4">
          <CategoryForm draft={draft} onChange={setDraft} onSubmit={() => void add()} onCancel={() => setAdding(false)} submitLabel={t('cats.add')} busy={busy} slugEditable idPrefix="new-cat" />
        </Card>
      )}

      {!list ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[76px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty title={t('cats.empty')} />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {list.map((c, i) => (
            <li key={c.slug} className="rounded-[18px] border border-[#E7E1D5] bg-white p-3">
              {editing === c.slug ? (
                <div className="p-1">
                  <CategoryForm draft={editDraft} onChange={setEditDraft} onSubmit={() => void saveEdit()} onCancel={() => setEditing(null)} submitLabel={t('common.save')} busy={busy} slugEditable={false} idPrefix={`edit-${c.slug}`} />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-none flex-col">
                    <button type="button" aria-label={t('cats.moveUp')} title={t('cats.moveUp')} disabled={busy || i === 0} onClick={() => move(i, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-transparent text-ink hover:bg-[#F1EEE7] disabled:opacity-30">
                      {Icon.up(18)}
                    </button>
                    <button type="button" aria-label={t('cats.moveDown')} title={t('cats.moveDown')} disabled={busy || i === list.length - 1} onClick={() => move(i, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-transparent text-ink hover:bg-[#F1EEE7] disabled:opacity-30">
                      {Icon.down(18)}
                    </button>
                  </div>
                  <div className="min-w-[160px] flex-1">
                    <div className="font-bold" dir="ltr" style={{ textAlign: startAlign() }}>
                      {c.name}
                    </div>
                    <div className="font-ar text-sm text-muted-2" dir="rtl" lang="ar" style={{ textAlign: 'start' }}>
                      {c.nameAr}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-2">
                      <span dir="ltr">/shop/{c.slug}</span> · {t('cats.products', { n: c.count ?? 0 })}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/shop/${c.slug}`} target="_blank" rel="noopener" className="inline-flex min-h-9 items-center rounded-xl px-3 text-[13px] font-bold">
                      {t('cats.viewOnShop')}
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(c.slug);
                        setEditDraft({ name: c.name, nameAr: c.nameAr, description: c.description ?? '', slug: c.slug });
                        setNotice('');
                      }}
                    >
                      {Icon.edit(16)} {t('cats.edit')}
                    </Button>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => startDelete(c)}>
                      {Icon.trash(16)} {t('cats.delete')}
                    </Button>
                  </div>
                </div>
              )}

              {deleting === c.slug && (
                <div className="mt-3 rounded-xl bg-[#FFF8E6] p-3 text-sm" role="alert">
                  <p className="mb-3 mt-0 font-semibold">{t('cats.hasProducts', { name: categoryLabel(c), n: c.count ?? 0 })}</p>
                  {list.length < 2 ? (
                    <p className="m-0 font-bold text-[#9B1C1C]">{t('cats.noOther')}</p>
                  ) : (
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="block min-w-[200px] flex-1">
                        <span className={label}>{t('cats.moveTo')}</span>
                        <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={inputCls}>
                          {list
                            .filter((x) => x.slug !== c.slug)
                            .map((x) => (
                              <option key={x.slug} value={x.slug}>
                                {categoryLabel(x)}
                              </option>
                            ))}
                        </select>
                      </label>
                      <Button variant="danger" disabled={busy || !moveTo} onClick={() => void remove(c)}>
                        {t('cats.moveAndDelete')}
                      </Button>
                      <Button variant="soft" onClick={() => setDeleting(null)}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
