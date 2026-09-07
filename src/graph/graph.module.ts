import { Module } from '@nestjs/common';

import { GraphClient } from './graph-client';
import { GraphClientFactory } from './graph-client-factory';
import { GraphTokenService } from './graph-token.service';
import { RecentFilesService } from './recent-files.service';
import { ConfigurationModule } from '../configuration/configuration.module';

@Module({
  imports: [ConfigurationModule],
  providers: [GraphClient, GraphClientFactory, GraphTokenService, RecentFilesService],
  exports: [GraphClient, GraphClientFactory, GraphTokenService, RecentFilesService],
})
export class GraphModule {}
