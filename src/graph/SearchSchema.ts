export enum ManagedPropertyType {
  Text = 'Text',
  YesNo = 'YesNo',
  Integer = 'Integer',
  DateTime = 'DateTime',
}

export interface ManagedPropertyDefinition {
  type: ManagedPropertyType;
  isQueryable: boolean;
  isSortable: boolean;
  isRefinable?: boolean;
  isRetrievable?: boolean;
}

export const SEARCH_SCHEMA = {
  // identifiers & paths
  path: { type: ManagedPropertyType.Text, isQueryable: true, isSortable: false },
  itemPath: {
    type: ManagedPropertyType.Text,
    isQueryable: true,
    isSortable: false,
    isRefinable: true,
  },
  defaultEncodingURL: {
    type: ManagedPropertyType.Text,
    isQueryable: false,
    isSortable: false,
    isRetrievable: true,
  },
  spSiteUrl: {
    type: ManagedPropertyType.Text,
    isQueryable: true,
    isSortable: false,
  },
  siteTitle: {
    type: ManagedPropertyType.Text,
    isQueryable: false,
    isSortable: false,
  },
  filename: {
    type: ManagedPropertyType.Text,
    isQueryable: false,
    isSortable: false,
  },

  // common metadata
  title: {
    type: ManagedPropertyType.Text,
    isQueryable: true,
    isSortable: true,
    isRetrievable: true,
  },
  authorOWSUSER: {
    type: ManagedPropertyType.Text,
    isQueryable: true,
    isSortable: false,
  },
  editorOWSUSER: {
    type: ManagedPropertyType.Text,
    isQueryable: false,
    isSortable: false,
  },
  modifierDates: {
    type: ManagedPropertyType.DateTime,
    isQueryable: true,
    isSortable: false,
  },
  modifierNames: {
    type: ManagedPropertyType.Text,
    isQueryable: true,
    isSortable: false,
  },
  modifierUPNs: {
    type: ManagedPropertyType.Text,
    isQueryable: false,
    isSortable: false,
  },
  modifiedOWSDATE: {
    type: ManagedPropertyType.DateTime,
    isQueryable: true,
    isSortable: true,
  },
  createdOWSDATE: {
    type: ManagedPropertyType.DateTime,
    isQueryable: true,
    isSortable: true,
  },
  lastModifiedTimeForRetention: {
    type: ManagedPropertyType.DateTime,
    isQueryable: true,
    isSortable: true,
    isRefinable: true,
    isRetrievable: true,
  },
  viewsRecent: {
    type: ManagedPropertyType.Integer,
    isQueryable: true,
    isSortable: true,
    isRetrievable: true,
  },
  viewsLifetime: {
    type: ManagedPropertyType.Integer,
    isQueryable: true,
    isSortable: true,
    isRetrievable: true,
  },
  description: {
    type: ManagedPropertyType.Text,
    isQueryable: false,
    isSortable: false,
  },

  // classification
  contentClass: {
    type: ManagedPropertyType.Text,
    isQueryable: true,
    isSortable: false,
  },
  isDocument: {
    type: ManagedPropertyType.YesNo,
    isQueryable: true,
    isSortable: false,
  },
  fileExtension: {
    type: ManagedPropertyType.Text,
    isQueryable: true,
    isSortable: false,
  },
  contentTypeId: {
    type: ManagedPropertyType.Text,
    isQueryable: true,
    isSortable: false,
  },

  // site page content
  canvasContent1OWSHTML: {
    type: ManagedPropertyType.Text,
    isQueryable: false,
    isSortable: false,
  },
  bannerImageUrl: {
    type: ManagedPropertyType.Text,
    isQueryable: false,
    isSortable: false,
  },
  pictureThumbnailUrl: {
    type: ManagedPropertyType.Text,
    isQueryable: false,
    isSortable: false,
  },
  promotedState: {
    type: ManagedPropertyType.Integer,
    isQueryable: true,
    isSortable: false,
  },
} as const satisfies Record<string, ManagedPropertyDefinition>;

export type SearchSchema = typeof SEARCH_SCHEMA;

export type SearchField = keyof SearchSchema;

export type QueryableField = {
  [K in SearchField]: SearchSchema[K]['isQueryable'] extends true ? K : never;
}[SearchField];

export type SortableField = {
  [K in SearchField]: SearchSchema[K]['isSortable'] extends true ? K : never;
}[SearchField];

export type RefinableField = {
  [K in SearchField]: SearchSchema[K] extends { readonly isRefinable: true } ? K : never;
}[SearchField];

export type RetrievableField = {
  [K in SearchField]: SearchSchema[K] extends { readonly isRetrievable: true } ? K : never;
}[SearchField];

type ManagedPropertyValue<TType extends ManagedPropertyType> = TType extends
  ManagedPropertyType.Text | ManagedPropertyType.DateTime
  ? string
  : TType extends ManagedPropertyType.YesNo
    ? boolean
    : number;

export type RetrievableFields = Partial<{
  [K in RetrievableField]: ManagedPropertyValue<SearchSchema[K]['type']>;
}>;

export type RangeableField = {
  [K in QueryableField]: SearchSchema[K]['type'] extends
    ManagedPropertyType.DateTime | ManagedPropertyType.Integer
    ? K
    : never;
}[QueryableField];
