import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import type { AdminCategory, AdminProduct } from '../../lib/api-types';
import { Button, Card, ErrorBox, Icon, Skeleton, Toggle, inputCls } from '../ui';
import { categoryLabel, errorText, startAlign, useT } from '../i18n';
import { uploadPhoto } from '../upload';
import { imageUrl } from '../../lib/images';
import { slugify } from '../../lib/slug';

interface VariantForm {
  /** Local key only, so React keeps each card's state while the list changes. */
  key: string;
  /** Empty for options added in this session: the server hands out the id. */
  catalogId: string;
  name: string;
  material: string;
  images: string[];
}
interface Form {
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  price: string;
  hidden: boolean;
  soldOut: boolean;
  /** Cover photo ('' = the first photo). */
  image: string;
  variants: VariantForm[];
}

let keyCounter = 0;
const newVariant = (over: Partial<VariantForm> = {}): VariantForm => ({ key: `v${++keyCounter}`, catalogId: '', name: '', material: '', images: [], ...over });
const blank = (): Form => ({ name: '', slug: '', description: '', category: '', tags: [], price: '', hidden: false, soldOut: false, image: '', variants: [newVariant()] });

const fromProduct = (p: AdminProduct): Form => ({
  name: p.name,
  slug: p.slug,
  description: p.description,
  category: p.category,
  tags: p.tags,
  price: p.price === null ? '' : String(p.price),
  hidden: p.hidden,
  soldOut: p.soldOut,
  image: p.image,
  variants: p.variants.map((v) => newVariant({ catalogId: v.catalogId, name: v.name, material: v.material, images: v.images })),
});

/** What goes to the API: local keys are left out, an empty price means "price pending". */
const toPayload = (f: Form) => ({
  name: f.name,
  slug: f.slug,
  description: f.description,
  category: f.category,
  tags: f.tags,
  image: f.image,
  price: f.price.trim() === '' ? null : Math.max(0, Math.round(Number(f.price))),
  hidden: f.hidden,
  soldOut: f.soldOut,
  variants: f.variants.map((v) => ({ catalogId: v.catalogId, name: v.name, material: v.material, images: v.images })),
});

const label = 'mb-1.5 block text-sm font-bold';
const hint = 'mb-0 mt-1 text-xs text-muted-2';

export function ProductEditPage() {
  const t = useT();
  const { id } = useParams();
  const isNew = id === undefined || id === 'new';
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState<Form | null>(null);
  const [initial, setInitial] = useState('');
  const [productId, setProductId] = useState<string | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [occasions, setOccasions] = useState<{ slug: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<'' | 'saved' | 'created'>((location.state as { created?: boolean } | null)?.created ? 'created' : '');
  /** Photos being uploaded, per option. */
  const [uploading, setUploading] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    setForm(null);
    setLoadError('');
    Promise.all([
      api<{ categories: AdminCategory[]; occasions: { slug: string; name: string }[] }>('/api/admin/categories'),
      isNew ? Promise.resolve(null) : api<{ product: AdminProduct }>(`/api/admin/products/${id}`),
    ]).then(
      ([meta, prod]) => {
        if (!alive) return;
        setCategories(meta.categories);
        setOccasions(meta.occasions);
        const f = prod ? fromProduct(prod.product) : blank();
        setProductId(prod?.product.id ?? null);
        setForm(f);
        setInitial(JSON.stringify(toPayload(f)));
      },
      (e: Error) => alive && setLoadError(errorText(e)),
    );
    return () => {
      alive = false;
    };
  }, [id, isNew]);

  const dirty = !!form && JSON.stringify(toPayload(form)) !== initial;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const upload = useRef<Promise<void>>(Promise.resolve());
  const uploadingNow = Object.values(uploading).some((n) => n > 0);

  if (loadError) {
    return (
      <ErrorBox
        message={loadError || t('pe.loadError')}
        onRetry={() => {
          setLoadError('');
          navigate(0);
        }}
      />
    );
  }
  if (!form) return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  );

  const set = (patch: Partial<Form>) => {
    setFlash('');
    setForm((f) => f && { ...f, ...patch });
  };
  const setVariant = (key: string, patch: Partial<VariantForm>) => set({ variants: form.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) });
  const allImages = form.variants.flatMap((v) => v.images);
  const cover = allImages.includes(form.image) ? form.image : allImages[0];
  const slugPreview = form.slug || slugify(form.name) || (productId ?? '…');

  // Photos are shrunk in the browser and uploaded one after the other, then added to the option.
  const addPhotos = (key: string, files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files];
    setError('');
    setUploading((u) => ({ ...u, [key]: (u[key] ?? 0) + list.length }));
    upload.current = upload.current.then(async () => {
      for (const file of list) {
        try {
          const url = await uploadPhoto(file);
          setFlash('');
          setForm((f) => f && { ...f, variants: f.variants.map((v) => (v.key === key ? { ...v, images: [...v.images, url] } : v)) });
        } catch (e) {
          setError(errorText(e));
        } finally {
          setUploading((u) => ({ ...u, [key]: Math.max(0, (u[key] ?? 1) - 1) }));
        }
      }
    });
  };

  const save = async () => {
    if (uploadingNow) return setError(t('pe.uploadingWait'));
    setBusy(true);
    setError('');
    try {
      const body = toPayload(form);
      if (isNew) {
        const r = await api<{ id: string }>('/api/admin/products', { method: 'POST', body });
        setInitial(JSON.stringify(body)); // nothing is unsaved any more: don't warn while leaving for the new product's page
        navigate(`/admin/products/${r.id}`, { replace: true, state: { created: true } });
      } else {
        const r = await api<{ slug: string }>(`/api/admin/products/${id}`, { method: 'PATCH', body });
        const next = { ...form, slug: r.slug };
        setForm(next);
        setInitial(JSON.stringify(toPayload(next)));
        setFlash('saved');
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t('pe.deleteConfirm', { name: form.name }))) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/products/${id}`, { method: 'DELETE' });
      setInitial(JSON.stringify(toPayload(form)));
      navigate('/admin/products');
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link
          to="/admin/products"
          onClick={(e) => {
            if (dirty && !window.confirm(t('pe.leave'))) e.preventDefault();
          }}
          className="inline-flex min-h-10 items-center gap-1.5 font-bold no-underline"
        >
          {Icon.back(16)} {t('pe.back')}
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[26px] font-bold leading-tight text-ink max-[560px]:text-[22px]">{isNew ? t('pe.titleNew') : form.name || t('pe.titleEdit')}</h1>
          {flash && <p className="mb-0 mt-1 text-sm font-bold text-[#1E6B3A]">{flash === 'created' ? t('pe.created') : t('pe.saved')}</p>}
        </div>
        {!isNew && (
          <a href={`/product/${form.slug}`} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold">
            {t('pe.viewOnShop')}
          </a>
        )}
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      <div className="grid items-start gap-4 min-[1000px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card title={t('pe.basics')}>
            <div className="grid gap-4">
              <div>
                <label htmlFor="pe-name" className={label}>
                  {t('pe.name')}
                </label>
                <input id="pe-name" value={form.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} dir="ltr" className={inputCls} style={{ textAlign: startAlign() }} />
                <p className={hint}>{t('pe.nameHint')}</p>
              </div>
              <div>
                <label htmlFor="pe-desc" className={label}>
                  {t('pe.description')}
                </label>
                <textarea id="pe-desc" value={form.description} maxLength={1000} rows={3} onChange={(e) => set({ description: e.target.value })} dir="ltr" className={`${inputCls} py-2.5`} style={{ textAlign: startAlign() }} />
                <p className={hint}>{t('pe.descriptionHint')}</p>
              </div>
              <div>
                <label htmlFor="pe-cat" className={label}>
                  {t('pe.category')}
                </label>
                <select id="pe-cat" value={form.category} onChange={(e) => set({ category: e.target.value })} className={inputCls}>
                  <option value="">{t('pe.chooseCategory')}</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="m-0 border-0 p-0">
                <legend className={label}>{t('pe.occasions')}</legend>
                <div className="flex flex-wrap gap-2">
                  {occasions.map((o) => {
                    const on = form.tags.includes(o.slug);
                    return (
                      <button
                        key={o.slug}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set({ tags: on ? form.tags.filter((x) => x !== o.slug) : [...form.tags, o.slug] })}
                        className={`min-h-10 rounded-xl border px-3.5 text-[13px] font-bold ${on ? 'border-ink bg-ink text-cream' : 'border-[#DDD6C8] bg-white text-ink'}`}
                      >
                        {o.name}
                      </button>
                    );
                  })}
                </div>
                <p className={hint}>{t('pe.occasionsHint')}</p>
              </fieldset>
              <div>
                <label htmlFor="pe-slug" className={label}>
                  {t('pe.slug')}
                </label>
                <input id="pe-slug" value={form.slug} maxLength={80} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} dir="ltr" placeholder={slugify(form.name)} className={inputCls} style={{ textAlign: startAlign() }} />
                <p className={hint}>
                  {t('pe.slugHint')} {t('pe.slugPreview')} <span dir="ltr">/product/{slugPreview}</span>
                </p>
              </div>
            </div>
          </Card>

          <Card title={t('pe.variants')}>
            <p className="mb-4 mt-0 text-sm text-muted-2">{t('pe.variantsHint')}</p>
            <div className="flex flex-col gap-4">
              {form.variants.map((v, i) => (
                <section key={v.key} aria-label={t('pe.variantNumber', { n: i + 1 })} className="rounded-2xl border border-[#E7E1D5] bg-[#FBF9F5] p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="m-0 text-sm font-bold">{t('pe.variantNumber', { n: i + 1 })}</h3>
                    {form.variants.length > 1 && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          if ((v.images.length || v.name) && !window.confirm(t('pe.removeVariantConfirm'))) return;
                          set({ variants: form.variants.filter((x) => x.key !== v.key) });
                        }}
                      >
                        {Icon.trash(16)} {t('pe.removeVariant')}
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`pe-vn-${v.key}`} className={label}>
                        {t('pe.variantName')}
                      </label>
                      <input id={`pe-vn-${v.key}`} value={v.name} maxLength={100} placeholder={t('pe.variantNamePlaceholder')} onChange={(e) => setVariant(v.key, { name: e.target.value })} dir="ltr" className={inputCls} style={{ textAlign: startAlign() }} />
                    </div>
                    <div>
                      <label htmlFor={`pe-vm-${v.key}`} className={label}>
                        {t('pe.material')}
                      </label>
                      <input id={`pe-vm-${v.key}`} value={v.material} maxLength={60} placeholder={t('pe.materialPlaceholder')} onChange={(e) => setVariant(v.key, { material: e.target.value })} dir="ltr" className={inputCls} style={{ textAlign: startAlign() }} />
                    </div>
                  </div>

                  <p className="mb-2 mt-4 text-sm font-bold">{t('pe.photos')}</p>
                  <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 min-[560px]:grid-cols-4 min-[1000px]:grid-cols-5">
                    {v.images.map((img, k) => (
                      <li key={img} className={`relative aspect-square overflow-hidden rounded-xl border bg-white ${img === cover ? 'border-[#D4AF5A] ring-2 ring-[#D4AF5A]/50' : 'border-[#E7E1D5]'}`}>
                        <img src={imageUrl(img, 320)} alt="" className="h-full w-full object-cover" loading="lazy" />
                        {img === cover && <span className="absolute bottom-1 start-1 rounded-md bg-[#D4AF5A] px-1.5 py-0.5 text-[10px] font-bold text-ink">{t('pe.cover')}</span>}
                        <div className="absolute end-1 top-1 flex flex-col gap-1">
                          <button type="button" aria-label={t('pe.removePhoto')} title={t('pe.removePhoto')} onClick={() => setVariant(v.key, { images: v.images.filter((x) => x !== img) })} className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-white/95 text-[#9B1C1C] shadow">
                            {Icon.close(16)}
                          </button>
                          {img !== cover && (
                            <button type="button" aria-label={t('pe.makeCover')} title={t('pe.makeCover')} onClick={() => set({ image: img })} className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-white/95 text-ink shadow">
                              {Icon.star(16)}
                            </button>
                          )}
                          {k > 0 && (
                            <button
                              type="button"
                              aria-label={t('pe.makeFirst')}
                              title={t('pe.makeFirst')}
                              onClick={() => setVariant(v.key, { images: [img, ...v.images.filter((x) => x !== img)] })}
                              className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-white/95 text-ink shadow"
                            >
                              {Icon.up(16)}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                    {Array.from({ length: uploading[v.key] ?? 0 }, (_, n) => (
                      <li key={`up-${n}`} className="skel flex aspect-square items-center justify-center rounded-xl text-[11px] font-bold text-muted-2" aria-busy="true">
                        {t('pe.uploading')}
                      </li>
                    ))}
                    <li>
                      <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#DDD6C8] bg-white text-center text-xs font-bold text-muted-2 hover:border-ink hover:text-ink focus-within:border-teal">
                        {Icon.plus(22)}
                        {t('pe.addPhotos')}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="sr-only"
                          onChange={(e) => {
                            addPhotos(v.key, e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </li>
                  </ul>
                  <p className={hint}>{t('pe.photosHint')}</p>
                </section>
              ))}
            </div>
            <Button variant="soft" className="mt-4" onClick={() => set({ variants: [...form.variants, newVariant()] })}>
              {Icon.plus(18)} {t('pe.addVariant')}
            </Button>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card title={t('pe.availability')}>
            <div className="grid gap-4">
              <div>
                <label htmlFor="pe-price" className={label}>
                  {t('pe.price')}
                </label>
                <input id="pe-price" type="number" inputMode="numeric" min={0} value={form.price} onChange={(e) => set({ price: e.target.value })} dir="ltr" placeholder="—" className={`${inputCls} text-center`} />
                <p className={hint}>{t('pe.priceHint')}</p>
              </div>
              <label className="flex items-center justify-between gap-3 text-sm font-bold">
                {t('pe.soldOut')}
                <Toggle checked={form.soldOut} onChange={(v) => set({ soldOut: v })} label={t('pe.soldOut')} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm font-bold">
                {t('pe.hidden')}
                <Toggle checked={form.hidden} onChange={(v) => set({ hidden: v })} label={t('pe.hidden')} />
              </label>
            </div>
          </Card>

          {!isNew && (
            <Card>
              <Button variant="danger" className="w-full" disabled={busy} onClick={() => void remove()}>
                {Icon.trash(18)} {t('pe.delete')}
              </Button>
            </Card>
          )}
        </div>
      </div>

      {(dirty || isNew) && (
        <div className="fixed inset-x-0 bottom-[70px] z-40 flex justify-center px-4 min-[900px]:bottom-6 min-[900px]:ms-[248px]">
          <div className="flex w-full max-w-[560px] items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-cream shadow-[0_20px_40px_-12px_rgba(11,46,51,.6)]">
            <span className="text-sm font-bold">{uploadingNow ? t('pe.uploading') : isNew ? t('pe.titleNew') : t('common.unsaved')}</span>
            <Button size="sm" disabled={busy || uploadingNow} onClick={() => void save()}>
              {busy ? t('common.saving') : isNew ? t('pe.create') : t('pe.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
