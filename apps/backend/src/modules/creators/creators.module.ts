import { Module } from '@nestjs/common';
import { CreatorsService } from './creators.service';
import { CreatorsController } from './creators.controller';
import { QueueModule } from '../../queue/queue.module';
import { GraphModule } from '../graph/graph.module';

@Module({
  imports: [QueueModule, GraphModule],
  providers: [CreatorsService],
  controllers: [CreatorsController],
  exports: [CreatorsService],
})
export class CreatorsModule {}
