import type { PaymentMethod } from './api-types';

/**
 * Open the customer's payment app (InstaPay / Vodafone Cash) instead of a web page.
 *
 * Neither app publishes a public deep link, so we launch the app itself:
 *  - Android: an `intent:` URL that starts the app by package name. If the app isn't
 *    installed, Chrome follows `browser_fallback_url` to the Play Store listing.
 *  - iOS: the App Store listing, which shows an "Open" button when the app is installed.
 *  - Desktop / unknown: nothing to open — the order page already shows the payment details.
 *
 * Vodafone Cash is a section inside the "Ana Vodafone" app, not a separate app.
 */
interface PaymentApp {
  android: string;
  ios: string;
}

const APPS: Record<'instapay' | 'vodafone', PaymentApp> = {
  instapay: { android: 'com.egyptianbanks.instapay', ios: '1592108795' },
  vodafone: { android: 'com.emeint.android.myservices', ios: '437564823' },
};

/** Which app handles this payment method? `null` = none (cash on delivery, or another wallet). */
export function paymentAppFor(method: PaymentMethod, walletName?: string): keyof typeof APPS | null {
  if (method === 'instapay') return 'instapay';
  if (method === 'wallet') {
    const name = (walletName ?? '').trim().toLowerCase();
    // The wallet name is configurable in admin settings; empty means the default (Vodafone Cash).
    if (!name || name.includes('vodafone') || name.includes('فودافون')) return 'vodafone';
  }
  return null;
}

export function androidIntentUrl(pkg: string): string {
  const fallback = encodeURIComponent(`https://play.google.com/store/apps/details?id=${pkg}`);
  return `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${pkg};S.browser_fallback_url=${fallback};end`;
}

export function appStoreUrl(id: string): string {
  return `https://apps.apple.com/app/id${id}`;
}

/** Returns the URL that opens the app on this device, or `null` if there is no mobile app to open. */
export function paymentAppUrl(app: keyof typeof APPS, userAgent: string, maxTouchPoints = 0): string | null {
  const ua = userAgent || '';
  if (/android/i.test(ua)) return androidIntentUrl(APPS[app].android);
  // iPadOS reports a Mac user agent, so also check for touch support.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1)) return appStoreUrl(APPS[app].ios);
  return null;
}

/** Launch the app. Call this after the page has already navigated, so the customer returns to their order. */
export function openPaymentApp(method: PaymentMethod, walletName?: string): void {
  if (typeof window === 'undefined') return;
  const app = paymentAppFor(method, walletName);
  if (!app) return;
  const url = paymentAppUrl(app, navigator.userAgent, navigator.maxTouchPoints);
  if (url) window.location.href = url;
}
