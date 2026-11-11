import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { Layout } from './components/Layout';
import { CtaFooter, SiteFooter } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductPage } from './pages/ProductPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderPage } from './pages/OrderPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { AccountPage } from './pages/AccountPage';
import { PrivacyPage } from './pages/PrivacyPage';

// The dashboard is a separate chunk: shoppers never download it.
const AdminApp = lazy(() => import('./admin/AdminApp'));

export function App() {
  const { pathname } = useLocation();

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#F4F1EA]" aria-busy="true" />}>
        <AdminApp />
      </Suspense>
    );
  }

  return (
    <Layout footer={pathname === '/' ? <CtaFooter /> : <SiteFooter />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/shop/:category" element={<ShopPage />} />
        <Route path="/product/:slug" element={<ProductPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order/:number" element={<OrderPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
