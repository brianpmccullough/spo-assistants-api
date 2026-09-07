import { SharePointContext } from './sharepoint-context';
import { AuthenticatedUser } from '../auth/authenticated-user';

export interface AssistantExecutionContext {
  user: AuthenticatedUser;
  sharePoint: SharePointContext;
}
