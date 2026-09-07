import { Module } from '@nestjs/common';

import { GraphClient } from './graph-client';
import { GraphClientFactory } from './graph-client-factory';
import { GraphTokenService } from './graph-token.service';
import { ConfigurationModule } from '../configuration/configuration.module';

@Module({
  imports: [ConfigurationModule],
  providers: [GraphClient, GraphClientFactory, GraphTokenService],
  exports: [GraphClient, GraphClientFactory, GraphTokenService],
})
export class GraphModule {}
