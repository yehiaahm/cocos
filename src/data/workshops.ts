import { useMemo } from 'react';
import type { PublicWorkshop } from '../lib/api-types';
import { defaultWorkshops } from '../lib/workshops';
import { useLive } from '../store/live';

/**
 * The workshops to show: the owner's list once /api/catalog has sent it (it may be empty — then the section is
 * hidden), otherwise the ones built into the site.
 */
export function useWorkshops(): readonly PublicWorkshop[] {
  const live = useLive((s) => s.workshops);
  return useMemo(() => live ?? defaultWorkshops, [live]);
}
