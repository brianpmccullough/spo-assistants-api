import { UnauthorizedException } from '@nestjs/common';

import { UsersService } from './users.service';
import { GraphClient } from '../graph/graph-client';
import { GraphError } from '../graph/graph-error';

describe('UsersService', () => {
  const get = jest.fn();
  const select = jest.fn().mockReturnValue({ get });
  const asUser = jest.fn().mockReturnValue({ me: { select } });
  const graphClient = { asUser } as unknown as GraphClient;
  const usersService = new UsersService(graphClient);

  beforeEach(() => {
    jest.clearAllMocks();
    select.mockReturnValue({ get });
    asUser.mockReturnValue({ me: { select } });
  });

  it('requests only the fields it needs, on behalf of the caller', async () => {
    get.mockResolvedValue({
      id: 'user-id',
      displayName: 'Test User',
      userPrincipalName: 'test.user@example.com',
    });

    const currentUser = await usersService.getCurrentUser('test-access-token');

    expect(asUser).toHaveBeenCalledWith('test-access-token');
    expect(select).toHaveBeenCalledWith('id', 'displayName', 'userPrincipalName');
    expect(currentUser).toEqual({
      id: 'user-id',
      displayName: 'Test User',
      userPrincipalName: 'test.user@example.com',
    });
  });

  it('rejects a response missing a required field rather than returning a partial user', async () => {
    get.mockResolvedValue({ id: 'user-id', displayName: 'Test User' });

    await expect(usersService.getCurrentUser('test-access-token')).rejects.toThrow(
      'missing required user fields',
    );
  });

  it('translates a Graph failure into an unauthorized response', async () => {
    get.mockRejectedValue(
      new GraphError('Access token is empty', 401, 'InvalidAuthenticationToken'),
    );

    await expect(usersService.getCurrentUser('test-access-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lets a non-Graph failure propagate untouched', async () => {
    get.mockRejectedValue(new TypeError('fetch failed'));

    await expect(usersService.getCurrentUser('test-access-token')).rejects.toBeInstanceOf(
      TypeError,
    );
  });
});
