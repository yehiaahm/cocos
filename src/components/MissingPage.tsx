import { useFreshCatalogOnMiss } from '../store/live';
import { NotFoundPage } from '../pages/NotFoundPage';
import { CatalogLoading } from './CatalogLoading';

/** "Not found" for a product / category slug — after one fresh look at the catalogue, in case it was just published. */
export function MissingPage() {
  const checking = useFreshCatalogOnMiss();
  return checking ? <CatalogLoading /> : <NotFoundPage />;
}
