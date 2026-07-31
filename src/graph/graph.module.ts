import { Module } from '@nestjs/common';

import { GraphClient } from './graph-client';
import { ConfigurationModule } from '../configuration/configuration.module';

@Module({
  imports: [ConfigurationModule],
  providers: [GraphClient],
  exports: [GraphClient],
})
export class GraphModule {}
