import { describe, expect, it } from 'vitest';
import { androidIntentUrl, paymentAppFor, paymentAppUrl } from './payment-apps';

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

describe('paymentAppUrl', () => {
  it('uses an Android intent with a Play Store fallback', () => {
    const url = paymentAppUrl('instapay', ANDROID)!;
    expect(url).toBe(androidIntentUrl('com.egyptianbanks.instapay'));
    expect(url).toContain('package=com.egyptianbanks.instapay');
    expect(url).toContain('S.browser_fallback_url=' + encodeURIComponent('https://play.google.com/store/apps/details?id=com.egyptianbanks.instapay'));
  });
  it('uses the App Store on iOS', () => {
    expect(paymentAppUrl('vodafone', IPHONE)).toBe('https://apps.apple.com/app/id437564823');
    expect(paymentAppUrl('vodafone', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('https://apps.apple.com/app/id437564823');
  });
  it('returns null on desktop', () => {
    expect(paymentAppUrl('instapay', DESKTOP)).toBeNull();
    expect(paymentAppUrl('instapay', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBeNull();
  });
});
