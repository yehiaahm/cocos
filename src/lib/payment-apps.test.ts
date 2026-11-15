import { describe, expect, it } from 'vitest';
import { androidIntentUrl, paymentAppFor, paymentLaunchUrl, parseInstapayLink, vodafoneUssdUrl } from './payment-apps';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

describe('paymentAppFor', () => {
  it('maps methods to apps', () => {
    expect(paymentAppFor('instapay')).toBe('instapay');
    expect(paymentAppFor('wallet')).toBe('vodafone');
    expect(paymentAppFor('wallet', 'Vodafone Cash')).toBe('vodafone');
    expect(paymentAppFor('wallet', 'فودافون كاش')).toBe('vodafone');
  });
  it('has no app for cash or other wallets', () => {
    expect(paymentAppFor('cod')).toBeNull();
    expect(paymentAppFor('wallet', 'Orange Cash')).toBeNull();
  });
});

describe('parseInstapayLink', () => {
  it('accepts an ipn.eg link, also inside share text', () => {
    expect(parseInstapayLink('https://ipn.eg/S/alice/instapay/2DcFGv')).toBe('https://ipn.eg/S/alice/instapay/2DcFGv');
    expect(parseInstapayLink('Click the link to send money to alice@instapay\nhttps://ipn.eg/S/alice/instapay/2DcFGv')).toBe(
      'https://ipn.eg/S/alice/instapay/2DcFGv',
    );
  });
  it('rejects other hosts and lookalikes', () => {
    expect(parseInstapayLink('')).toBeNull();
    expect(parseInstapayLink(undefined)).toBeNull();
    expect(parseInstapayLink('http://ipn.eg/S/a/instapay/x')).toBeNull();
    expect(parseInstapayLink('https://ipn.eg.evil.com/S/a/instapay/x')).toBeNull();
    expect(parseInstapayLink('https://ipn.eg@evil.com/S/a/instapay/x')).toBeNull();
    expect(parseInstapayLink('https://evil.com/?u=https://ipn.eg')).toBeNull();
  });
});

describe('InstaPay payment link', () => {
  const link = 'https://ipn.eg/S/alice/instapay/2DcFGv';
  it('is opened on phones instead of the bare app', () => {
    expect(paymentLaunchUrl({ method: 'instapay', instapayLink: link, total: 450 }, ANDROID)).toBe(link);
    expect(paymentLaunchUrl({ method: 'instapay', instapayLink: link, total: 450 }, IPHONE)).toBe(link);
  });
  it('is ignored when invalid, and never used on desktop', () => {
    expect(paymentLaunchUrl({ method: 'instapay', instapayLink: 'https://evil.com/x', total: 450 }, ANDROID)).toBe(androidIntentUrl('com.egyptianbanks.instapay'));
    expect(paymentLaunchUrl({ method: 'instapay', instapayLink: link, total: 450 }, DESKTOP)).toBeNull();
  });
});

describe('vodafoneUssdUrl', () => {
  it('builds a pre-filled transfer code with the # encoded', () => {
    expect(vodafoneUssdUrl('010 1234 5678', 450)).toBe('tel:*9*7*01012345678*450%23');
    expect(vodafoneUssdUrl('+201012345678', 450)).toBe('tel:*9*7*01012345678*450%23');
  });
  it('refuses a bad number or a non-whole amount', () => {
    expect(vodafoneUssdUrl('12345', 450)).toBeNull();
    expect(vodafoneUssdUrl('01012345678', 450.5)).toBeNull();
    expect(vodafoneUssdUrl('01012345678', 0)).toBeNull();
  });
});

describe('paymentLaunchUrl', () => {
  const wallet = { method: 'wallet' as const, wallet: '01012345678', total: 450 };

  it('Vodafone Cash opens the dialer with number and amount filled in, on Android and iOS', () => {
    expect(paymentLaunchUrl(wallet, ANDROID)).toBe('tel:*9*7*01012345678*450%23');
    expect(paymentLaunchUrl(wallet, IPHONE)).toBe('tel:*9*7*01012345678*450%23');
  });
  it('Vodafone Cash falls back to the app when it cannot pre-fill', () => {
    expect(paymentLaunchUrl({ ...wallet, total: null }, ANDROID)).toBe(androidIntentUrl('com.emeint.android.myservices'));
    expect(paymentLaunchUrl({ ...wallet, total: 450.5 }, IPHONE)).toBe('https://apps.apple.com/app/id437564823');
    expect(paymentLaunchUrl({ ...wallet, wallet: '' }, ANDROID)).toBe(androidIntentUrl('com.emeint.android.myservices'));
  });
  it('InstaPay uses an Android intent with a Play Store fallback', () => {
    const url = paymentLaunchUrl({ method: 'instapay', total: 450 }, ANDROID)!;
    expect(url).toBe(androidIntentUrl('com.egyptianbanks.instapay'));
    expect(url).toContain('package=com.egyptianbanks.instapay');
    expect(url).toContain('S.browser_fallback_url=' + encodeURIComponent('https://play.google.com/store/apps/details?id=com.egyptianbanks.instapay'));
  });
  it('InstaPay uses the App Store on iOS, including iPadOS', () => {
    expect(paymentLaunchUrl({ method: 'instapay', total: 450 }, IPHONE)).toBe('https://apps.apple.com/app/id1592108795');
    expect(paymentLaunchUrl({ method: 'instapay', total: 450 }, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('https://apps.apple.com/app/id1592108795');
  });
  it('returns null on desktop, for cash, and for other wallets', () => {
    expect(paymentLaunchUrl({ method: 'instapay', total: 450 }, DESKTOP)).toBeNull();
    expect(paymentLaunchUrl({ method: 'instapay', total: 450 }, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBeNull();
    expect(paymentLaunchUrl({ method: 'cod', total: 450 }, ANDROID)).toBeNull();
    expect(paymentLaunchUrl({ ...wallet, walletName: 'Orange Cash' }, ANDROID)).toBeNull();
  });
});
