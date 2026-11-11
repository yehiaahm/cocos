import { Link, useLocation } from 'react-router';
import { Seo } from '../lib/seo';
import { ArrowRight } from '../components/Icons';

export function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <>
      <Seo title="Page not found" path={pathname} noindex />
      <section className="container-page relative overflow-x-clip pb-32 pt-12 text-center">
        <div
          aria-hidden="true"
          className="morph pointer-events-none absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 opacity-80 [background:radial-gradient(circle_at_40%_40%,rgba(79,209,197,.35),rgba(79,209,197,0)_65%)]"
        />
        <p className="relative m-0 font-script text-[clamp(96px,16vw,180px)] leading-none text-gold-dark">404</p>
        <h1 className="relative mb-0 mt-2 font-serif text-[clamp(38px,5vw,64px)] font-medium leading-none">
          This piece <em>slipped away.</em>
        </h1>
        <p className="relative mx-auto mt-5 max-w-[480px] text-[17px] leading-[1.7] text-muted">
          The page you're looking for doesn't exist or has moved. Everything handmade is still in the shop.
        </p>
        <div className="relative mt-9 flex flex-wrap justify-center gap-3">
          <Link to="/shop" className="btn btn-primary inline-flex min-h-[54px] items-center gap-2.5 rounded-full bg-teal-btn px-7 font-bold text-white no-underline hover:text-white">
            Visit the shop <ArrowRight />
          </Link>
          <Link to="/" className="btn btn-ghost inline-flex min-h-[54px] items-center rounded-full border-[1.5px] border-ink px-7 font-bold text-ink no-underline">
            Back to home
          </Link>
        </div>
      </section>
    </>
  );
}
