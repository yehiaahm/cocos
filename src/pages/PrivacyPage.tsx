import type { ReactNode } from 'react';
import { Seo } from '../lib/seo';
import { site } from '../config/site';

/** Privacy policy + terms (also the links Google shows on its "Continue with Google" screen). */
export function PrivacyPage() {
  return (
    <>
      <Seo title="Privacy & terms" path="/privacy" description={`How ${site.name} uses your information, and the terms of ordering from the shop.`} />
      <article className="container-page max-w-[820px] pb-28 pt-4">
        <p className="eyebrow mb-3">Privacy &amp; terms · الخصوصية والشروط</p>
        <h1 className="m-0 font-serif text-[clamp(40px,6vw,72px)] font-medium leading-[.95] tracking-[-.02em]">
          Your details, <em>kept safe.</em>
        </h1>
        <p className="mt-4 text-[17px] leading-[1.7] text-muted">
          {site.name} is a small handmade studio in {site.country}. This page explains what we collect when you order or create an account, and why.
        </p>

        <Section title="What we collect">
          <li><strong>Orders:</strong> your name, mobile number, city, delivery address, notes and the items you order, so we can make, price and deliver them.</li>
          <li><strong>Accounts (optional):</strong> your name, email and a securely hashed password. If you use “Continue with Google”, Google shares only your name, email address and profile photo with us. We never see your Google password.</li>
          <li><strong>Payment proof:</strong> if you pay by InstaPay or wallet, the transfer screenshot you upload.</li>
          <li><strong>Technical:</strong> a sign-in cookie that keeps you logged in, your cart saved in your own browser, and a one-way hash of your IP address used only to block spam and abuse.</li>
        </Section>

        <Section title="How we use it">
          <li>To confirm, make, price and deliver your order, and to contact you about it by phone or WhatsApp.</li>
          <li>To show your orders in your account and fill in checkout for you.</li>
          <li>We do not sell, rent or share your information with anyone, and we do not use it for advertising. Delivery details are shared only with the courier delivering your order.</li>
        </Section>

        <Section title="Your choices">
          <li>You can order as a guest without an account.</li>
          <li>You can update your details from your account page at any time.</li>
          <li>To delete your account or your data, message us on Instagram (@{site.instagramHandle}) and we will remove it. You can also remove the site’s access from your Google account settings.</li>
        </Section>

        <Section title="Terms of ordering">
          <li>Every piece is handmade, so colours and patterns vary slightly from the photos.</li>
          <li>Prices shown as “Price pending” are confirmed by Coco before you pay. Nothing is charged when you place an order.</li>
          <li>Personalised pieces are made to order and can’t be returned unless they arrive damaged or wrong. Please contact us within 48 hours of delivery if there is a problem.</li>
          <li>Delivery is across {site.country}; timing and fee are confirmed with your order.</li>
        </Section>

        <p className="mt-10 text-sm text-muted-2">Questions? Message us on Instagram: @{site.instagramHandle}.</p>
      </article>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="m-0 font-serif text-[32px] font-medium">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2.5 pl-5 text-[16px] leading-[1.7] text-muted">{children}</ul>
    </section>
  );
}
