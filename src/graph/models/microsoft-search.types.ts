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
