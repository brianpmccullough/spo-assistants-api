import { Module } from '@nestjs/common';

import { MeController } from './me.controller';
import { UsersService } from './users.service';
import { GraphModule } from '../graph/graph.module';

@Module({
  imports: [GraphModule],
  controllers: [MeController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
