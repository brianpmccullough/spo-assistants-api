/**
 * The signed-in user, with every field guaranteed present. Microsoft Graph types
 * every field as optional, so this is what the users module hands to the rest of
 * the app once it has validated the response.
 */
export interface CurrentUser {
  readonly id: string;
  readonly displayName: string;
  readonly userPrincipalName: string;
}
