import { Module } from '@nestjs/common';
import { CreatorsService } from './creators.service';
import { CreatorsController } from './creators.controller';
import { QueueModule } from '../../queue/queue.module';

@Module({
  imports: [QueueModule],
  providers: [CreatorsService],
  controllers: [CreatorsController],
  exports: [CreatorsService],
})
export class CreatorsModule {}
