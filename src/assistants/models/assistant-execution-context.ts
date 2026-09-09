import { SharePointContext } from './sharepoint-context';
import { AuthenticatedUser } from '../../auth/models/authenticated-user';

export interface AssistantExecutionContext {
  user: AuthenticatedUser;
  sharePoint: SharePointContext;
}
