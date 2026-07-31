export interface AuthenticatedUser {
  readonly id: string;
  readonly displayName?: string;
  readonly userPrincipalName?: string;
  readonly accessToken: string;
}
