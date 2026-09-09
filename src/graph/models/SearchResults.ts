import type { RetrievableField, RetrievableFields } from '../SearchSchema';

/**
 * Response shapes returned by the Microsoft Graph Search API.
 *
 * Search resources vary by entity type, so callers supply the partial resource
 * shape they request in their search fields.
 */
export interface MicrosoftSearchQueryResponse<TResource> {
  readonly value?: MicrosoftSearchResponse<TResource>[];
}

export interface MicrosoftSearchResponse<TResource> {
  readonly hitsContainers?: MicrosoftSearchHitsContainer<TResource>[];
}

export interface MicrosoftSearchHitsContainer<TResource> {
  readonly hits?: MicrosoftSearchHit<TResource>[];
}

export interface MicrosoftSearchHit<TResource> {
  readonly resource?: TResource;
}

export interface ListItemSearchResource<TFields extends RetrievableField = RetrievableField> {
  readonly '@odata.type': '#microsoft.graph.listItem';
  readonly lastModifiedDateTime?: string;
  readonly fields?: Pick<RetrievableFields, TFields>;
}

export interface DriveItemSearchResource<TFields extends RetrievableField = RetrievableField> {
  readonly '@odata.type': '#microsoft.graph.driveItem';
  readonly lastModifiedDateTime?: string;
  readonly listItem?: {
    readonly fields?: Pick<RetrievableFields, TFields>;
  };
}
