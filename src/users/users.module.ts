import { Module } from '@nestjs/common';

import { MeController } from './me.controller';
import { GraphModule } from '../graph/graph.module';

@Module({
  imports: [GraphModule],
  controllers: [MeController],
})
export class UsersModule {}
