/** Shown instead of "not found" while the live catalogue (products added in the dashboard) is still on its way. */
export function CatalogLoading() {
  return (
    <div className="container-page min-h-[60vh] py-24" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
    </div>
  );
}
