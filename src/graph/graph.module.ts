import { Module } from '@nestjs/common';

import { GraphClient } from './graph-client';
import { GraphClientFactory } from './graph-client-factory';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [GraphClient, GraphClientFactory],
  exports: [GraphClient, GraphClientFactory],
})
export class GraphModule {}
