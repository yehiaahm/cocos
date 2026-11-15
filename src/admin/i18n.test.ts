import { afterEach, describe, expect, it } from 'vitest';
import { ALL_KEYS, categoryLabel, dirOf, eventText, getLang, localizeServerMessage, setLang, t } from './i18n';
import { STATUS, money } from './format';

afterEach(() => setLang('ar'));

describe('admin language', () => {
  it('defaults to Arabic and is right-to-left', () => {
    expect(getLang()).toBe('ar');
    expect(dirOf()).toBe('rtl');
  });

  it('switches to English (left-to-right) and remembers the choice', () => {
    setLang('en');
    expect(getLang()).toBe('en');
    expect(dirOf()).toBe('ltr');
    expect(localStorage.getItem('coco-admin-lang')).toBe('en');
    expect(t('nav.products')).toBe('Products');
    setLang('ar');
    expect(t('nav.products')).toBe('المنتجات');
  });

  it('has every key in both languages, and Arabic text is really Arabic', () => {
    for (const lang of ['ar', 'en'] as const) {
      setLang(lang);
      for (const key of ALL_KEYS) {
        const text = t(key);
        expect(text, `${lang}:${key}`).toBeTruthy();
        expect(text, `${lang}:${key} must not fall back to the key`).not.toBe(key);
      }
    }
    setLang('ar');
    for (const key of ALL_KEYS.filter((k) => !k.endsWith('_one') && !k.startsWith('srv.') && !['lang.switch'].includes(k))) {
      // Arabic strings contain Arabic letters — except a few that are only symbols/brands.
      const text = t(key);
      const exempt = ['pay.', 'method.instapay'].some((p) => key.startsWith(p)) && !/[؀-ۿ]/.test(text);
      if (!exempt) expect(/[؀-ۿ]/.test(text), `ar:${key} → ${text}`).toBe(true);
    }
  });

  it('fills placeholders and pluralises', () => {
    setLang('en');
    expect(t('orders.count', { n: 1 })).toBe('1 order');
    expect(t('orders.count', { n: 5 })).toBe('5 orders');
    expect(t('prod.sub', { priced: 3, total: 80 })).toBe('3 of 80 products have a price · Changes show on the site within a minute');
    setLang('ar');
    expect(t('orders.count', { n: 1 })).toBe('1 طلب');
  });

  it('formats money and order status in the current language', () => {
    expect(money(1250)).toBe('1,250 ج.م');
    expect(STATUS.in_progress.label).toBe('قيد التنفيذ');
    setLang('en');
    expect(money(1250)).toBe('1,250 EGP');
    expect(money(null)).toBe('—');
    expect(STATUS.in_progress.label).toBe('In progress');
  });

  it('shows the Arabic category name in Arabic and the English one in English', () => {
    const concrete = { name: 'Concrete Works', nameAr: 'أعمال كونكريت' };
    expect(categoryLabel(concrete)).toBe('أعمال كونكريت');
    setLang('en');
    expect(categoryLabel(concrete)).toBe('Concrete Works');
    expect(categoryLabel({ name: 'Resin' })).toBe('Resin');
  });

  it('translates server messages and stored order history in English mode only', () => {
    expect(localizeServerMessage('الطلب غير موجود')).toBe('الطلب غير موجود');
    expect(eventText({ type: 'created', message: 'تم استلام الطلب من الموقع' })).toBe('تم استلام الطلب من الموقع');
    setLang('en');
    expect(localizeServerMessage('الطلب غير موجود')).toBe('Order not found');
    expect(localizeServerMessage('منتج غير معروف: coco-999')).toBe('Unknown product: coco-999');
    expect(localizeServerMessage('Something else')).toBe('Something else');
    expect(eventText({ type: 'created', message: 'تم استلام الطلب من الموقع' })).toBe('Order received from the website');
    expect(eventText({ type: 'proof', message: 'العميل رفع صورة التحويل' })).toBe('Customer uploaded the transfer screenshot');
    expect(eventText({ type: 'status', message: 'الحالة: جديد ← مؤكد' })).toBe('Status: New → Confirmed');
    expect(eventText({ type: 'payment', message: 'الدفع: لم يُدفع ← إيصال بانتظار المراجعة' })).toBe('Payment: Unpaid → Receipt to review');
    expect(eventText({ type: 'pricing', message: 'الإجمالي: 1250 ج.م' })).toBe('Total: 1250 EGP');
    expect(eventText({ type: 'pricing', message: 'تم تحديث الأسعار' })).toBe('Prices updated');
    expect(eventText({ type: 'other', message: 'unknown text' })).toBe('unknown text');
  });
});
