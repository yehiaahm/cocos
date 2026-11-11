import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { HeadProvider } from './lib/seo';
import './styles/index.css';

const container = document.getElementById('root')!;
const app = (
  <StrictMode>
    <HeadProvider value={{}}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HeadProvider>
  </StrictMode>
);

const clean = (p: string) => decodeURI(p).replace(/\/+$/, '') || '/';
const prerenderedFor = container.dataset.path;

// Hydrate only when the static HTML was rendered for this exact URL. If a host served
// another page's HTML (e.g. an SPA fallback), render fresh instead of mismatching.
if (container.firstElementChild && prerenderedFor && (prerenderedFor === '*' || clean(prerenderedFor) === clean(location.pathname))) {
  hydrateRoot(container, app);
} else {
  container.textContent = '';
  createRoot(container).render(app);
}
