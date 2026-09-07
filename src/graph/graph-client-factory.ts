import { Client } from '@microsoft/microsoft-graph-client';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GraphClientFactory {
  create(accessToken: string) {
    return Client.init({
      authProvider: (done) => done(null, accessToken),
    });
  }
}
