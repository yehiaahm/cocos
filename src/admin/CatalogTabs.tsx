import { NavLink } from 'react-router';
import { useT } from './i18n';

/** Switch between the two catalogue screens: products and categories. */
export function CatalogTabs() {
  const t = useT();
  const cls = ({ isActive }: { isActive: boolean }) =>
    `min-h-10 rounded-lg px-4 text-[13px] font-bold no-underline inline-flex items-center ${isActive ? 'bg-white text-ink shadow-sm' : 'text-muted-2 hover:text-ink'}`;
  return (
    <nav aria-label={t('nav.products')} className="mb-4 inline-flex rounded-xl bg-[#F1EEE7] p-1">
      <NavLink to="/admin/products" end className={cls}>
        {t('cat.tab.products')}
      </NavLink>
      <NavLink to="/admin/categories" className={cls}>
        {t('cat.tab.categories')}
      </NavLink>
    </nav>
  );
}
