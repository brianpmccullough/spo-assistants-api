import type { SortableField } from '../../graph/SearchSchema';

export enum PopularContentViewPeriod {
  Recent = 'viewsRecent',
  Lifetime = 'viewsLifetime',
}

export const POPULAR_CONTENT_VIEW_PERIODS: readonly SortableField[] = [
  PopularContentViewPeriod.Recent,
  PopularContentViewPeriod.Lifetime,
];

export interface SiteContentItem {
  readonly name: string;
  readonly webUrl: string;
  readonly lastModifiedTimeForRetention?: string;
  readonly viewCount?: number;
}
