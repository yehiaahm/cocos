import type { PaymentMethod } from './api-types';
import { normaliseEgyptPhone } from './phone';

/**
 * Take the customer straight into their payment app, with as much pre-filled as the app allows.
 *
 * - Vodafone Cash: a USSD transfer code (`*9*7*<wallet>*<amount>#`) in a `tel:` link. The dialer opens
 *   with the wallet number and amount already typed; the customer presses call and enters their PIN.
 *   Needs a whole-pound total and a valid wallet number; otherwise we open the Ana Vodafone app instead.
 * - InstaPay: has no public deep link and no way to pre-fill an amount, so we copy the InstaPay address
 *   to the clipboard and open the app (Android intent → Play Store fallback; iOS → App Store listing,
 *   which has an "Open" button when installed). The amount is shown on the order page.
 * - Desktop / unknown device: nothing to open — the order page already shows the payment details.
 */
interface PaymentApp {
  android: string;
  ios: string;
}

const APPS: Record<'instapay' | 'vodafone', PaymentApp> = {
  instapay: { android: 'com.egyptianbanks.instapay', ios: '1592108795' },
  // Vodafone Cash is a section of the Ana Vodafone app, not a separate app.
  vodafone: { android: 'com.emeint.android.myservices', ios: '437564823' },
};

type AppId = keyof typeof APPS;

/** Which app handles this payment method? `null` = none (cash on delivery, or another wallet). */
export function paymentAppFor(method: PaymentMethod, walletName?: string): AppId | null {
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

/** `tel:` link that opens the dialer with the Vodafone Cash transfer code typed in (`#` must be `%23`). */
export function vodafoneUssdUrl(wallet: string, amount: number): string | null {
  const number = normaliseEgyptPhone(wallet);
  if (!number || !Number.isInteger(amount) || amount < 1) return null;
  return `tel:*9*7*${number}*${amount}%23`;
}

function platform(userAgent: string, maxTouchPoints: number): 'android' | 'ios' | null {
  if (/android/i.test(userAgent)) return 'android';
  // iPadOS reports a Mac user agent, so also check for touch support.
  if (/iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1)) return 'ios';
  return null;
}

export interface PaymentTarget {
  method: PaymentMethod;
  walletName?: string;
  /** Shop's Vodafone Cash wallet number. */
  wallet?: string;
  /** What the customer owes; `null` while the total isn't confirmed yet. */
  total: number | null;
}

/** The URL that takes this customer into the payment app on this device, or `null` if there's nothing to open. */
export function paymentLaunchUrl(t: PaymentTarget, userAgent: string, maxTouchPoints = 0): string | null {
  const app = paymentAppFor(t.method, t.walletName);
  const os = platform(userAgent || '', maxTouchPoints);
  if (!app || !os) return null;
  if (app === 'vodafone' && t.total !== null && t.wallet) {
    const ussd = vodafoneUssdUrl(t.wallet, t.total);
    if (ussd) return ussd;
  }
  return os === 'android' ? androidIntentUrl(APPS[app].android) : appStoreUrl(APPS[app].ios);
}

/**
 * Launch the payment app. Call it from a click handler, or right after the order is placed (the browser
 * still counts that as the customer's own action). For InstaPay, copies the address first so it can be pasted.
 */
export function launchPayment(t: PaymentTarget & { instapay?: string }): boolean {
  if (typeof window === 'undefined') return false;
  const url = paymentLaunchUrl(t, navigator.userAgent, navigator.maxTouchPoints);
  if (!url) return false;
  if (t.method === 'instapay' && t.instapay) {
    try {
      void navigator.clipboard?.writeText(t.instapay).catch(() => {});
    } catch {
      /* clipboard blocked */
    }
  }
  window.location.href = url;
  return true;
}
